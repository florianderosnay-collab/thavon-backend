# main.py content (Updated to include FUB Fulfillment)

from fastapi import FastAPI, BackgroundTasks, HTTPException, Body, Request
from pydantic import BaseModel
import requests
from supabase import create_client, Client
import json
import os
import time # For mocking delay
from datetime import datetime
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:
    from backports.zoneinfo import ZoneInfo  # Fallback for older Python

# --- ENVIRONMENT VARIABLES (Ensure these are set on Railway) ---
# NOTE: VAPI_Private_Key is your API Key from Vapi, not the Vapi Number ID.
VAPI_Private_Key = os.environ.get("VAPI_API_KEY") 
# Support both NEXT_PUBLIC_SUPABASE_URL (Next.js convention) and SUPABASE_URL (standard)
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # We use the Service Role Key for secure backend calls

# #region agent log
log_path = "/Users/florianrosnay/Desktop/thavon-complete/.cursor/debug.log"
try:
    with open(log_path, "a") as f:
        import json
        log_entry = {
            "sessionId": "debug-session",
            "runId": "init",
            "hypothesisId": "A",
            "location": "main.py:14-15",
            "message": "Environment variables check",
            "data": {
                "NEXT_PUBLIC_SUPABASE_URL_set": SUPABASE_URL is not None,
                "NEXT_PUBLIC_SUPABASE_URL_value": SUPABASE_URL[:20] + "..." if SUPABASE_URL and len(SUPABASE_URL) > 20 else SUPABASE_URL,
                "SUPABASE_SERVICE_ROLE_KEY_set": SUPABASE_KEY is not None,
                "SUPABASE_SERVICE_ROLE_KEY_length": len(SUPABASE_KEY) if SUPABASE_KEY else 0,
                "all_env_keys": [k for k in os.environ.keys() if "SUPABASE" in k or "VAPI" in k]
            },
            "timestamp": int(time.time() * 1000)
        }
        f.write(json.dumps(log_entry) + "\n")
except Exception as e:
    pass
# #endregion

# --- INITIALIZATION ---
app = FastAPI()

# #region agent log
try:
    with open(log_path, "a") as f:
        log_entry = {
            "sessionId": "debug-session",
            "runId": "init",
            "hypothesisId": "B",
            "location": "main.py:19",
            "message": "Before create_client call",
            "data": {
                "SUPABASE_URL_type": type(SUPABASE_URL).__name__,
                "SUPABASE_URL_is_none": SUPABASE_URL is None,
                "SUPABASE_URL_empty": SUPABASE_URL == "" if SUPABASE_URL else True,
                "SUPABASE_KEY_is_none": SUPABASE_KEY is None
            },
            "timestamp": int(time.time() * 1000)
        }
        f.write(json.dumps(log_entry) + "\n")
except Exception as e:
    pass
# #endregion

# Validate environment variables before creating client
if not SUPABASE_URL:
    error_msg = "SUPABASE_URL is required. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable in Railway."
    print(f"❌ FATAL ERROR: {error_msg}")
    # #region agent log
    try:
        with open(log_path, "a") as f:
            log_entry = {
                "sessionId": "debug-session",
                "runId": "init",
                "hypothesisId": "C",
                "location": "main.py:validation",
                "message": "SUPABASE_URL validation failed",
                "data": {"error": error_msg},
                "timestamp": int(time.time() * 1000)
            }
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        pass
    # #endregion
    raise ValueError(error_msg)

if not SUPABASE_KEY:
    error_msg = "SUPABASE_SERVICE_ROLE_KEY is required. Please set this environment variable in Railway."
    print(f"❌ FATAL ERROR: {error_msg}")
    raise ValueError(error_msg)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- FIX CORS (ALLOW VERCEL TO TALK TO RAILWAY) ---
from fastapi.middleware.cors import CORSMiddleware

# SECURITY: Restrict CORS to specific origins
allowed_origins = [
    "https://app.thavon.io",
    "https://thavon.io",
    "http://localhost:3000",  # Only for local development
]

# Allow all origins in development if NEXT_PUBLIC_BASE_URL is not set
if os.environ.get("ENVIRONMENT") != "production":
    allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Webhook-Signature"],
)

# --- DATA MODELS ---
class CampaignRequest(BaseModel):
    agency_id: str

# --- OFFICE HOURS HELPERS ---

def get_agency_timezone(agency_id: str) -> str:
    """
    Fetches the agency's timezone from the database.
    Defaults to 'Europe/Luxembourg' if not set.
    """
    try:
        response = supabase.table('agencies').select('timezone').eq('id', agency_id).single().execute()
        timezone = response.data.get('timezone') if response.data else None
        return timezone or 'Europe/Luxembourg'  # Default timezone
    except Exception as e:
        print(f"Error fetching agency timezone: {e}, defaulting to Europe/Luxembourg")
        return 'Europe/Luxembourg'

def is_within_office_hours(agency_id: str) -> bool:
    """
    Checks if the current time is within office hours (8:00 AM - 9:00 PM)
    based on the agency's timezone.
    """
    try:
        timezone_str = get_agency_timezone(agency_id)
        tz = ZoneInfo(timezone_str)
        now = datetime.now(tz)
        current_hour = now.hour
        
        # Office hours: 8:00 AM (8) to 9:00 PM (21)
        is_office_hours = 8 <= current_hour < 21
        
        print(f"⏰ Office Hours Check for Agency {agency_id}: {now.strftime('%Y-%m-%d %H:%M:%S %Z')} - {'✅ OPEN' if is_office_hours else '❌ CLOSED'}")
        return is_office_hours
    except Exception as e:
        print(f"Error checking office hours: {e}, defaulting to True (allow call)")
        return True  # Default to allowing calls if timezone check fails

# --- FULFILLMENT HELPERS (NEW LOGIC) ---

def get_agency_fub_key(agency_id: str) -> str | None:
    """Fetches the Follow Up Boss API Key for the agency."""
    try:
        response = supabase.table('agencies').select('fub_api_key').eq('id', agency_id).single().execute()
        return response.data.get('fub_api_key')
    except Exception as e:
        print(f"Error fetching FUB key: {e}")
        return None

def push_to_followup_boss(fub_key: str, lead_name: str, lead_phone: str, summary: str):
    """Mocks sending a POST request to the Follow Up Boss API."""
    print(f"   -> FUB FULFILLMENT: Pushing Note to FUB for {lead_name}...")
    
    # --- FUB API PAYLOAD (Standard FUB Event API v1) ---
    # This is where you would build the real API call
    headers = {
        "Authorization": f"Basic {fub_key}:", # FUB uses Basic Auth with API Key as username
        "Content-Type": "application/json"
    }
    
    payload = {
        "eventName": "Thavon AI Call Completed",
        "eventTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "lead": {
            "emails": [], # Optional: Add lead's email if available
            "phones": [lead_phone],
            "name": lead_name,
        },
        "note": summary,
        "source": "Thavon AI Voice Platform"
    }
    
    # In a real environment, you would use requests.post here
    # response = requests.post("https://api.followupboss.com/v1/events", headers=headers, json=payload)
    # print(f"   -> FUB API Status: {response.status_code}")
    
    # MOCKING SUCCESSFUL PUSH
    print(f"   -> FUB MOCK SUCCESS: Note for {lead_name} created.")


# --- VAPI CALLER (Existing Logic) ---

def trigger_vapi_call(payload):
    """Executes the Vapi API Call in the background."""
    # #region agent log
    try:
        with open(log_path, "a") as f:
            log_entry = {
                "sessionId": "debug-session",
                "runId": "call-debug",
                "hypothesisId": "A",
                "location": "main.py:trigger_vapi_call:entry",
                "message": "trigger_vapi_call called",
                "data": {
                    "customer_name": payload.get('customer', {}).get('name', 'unknown'),
                    "has_vapi_key": VAPI_Private_Key is not None,
                    "vapi_key_length": len(VAPI_Private_Key) if VAPI_Private_Key else 0,
                    "payload_keys": list(payload.keys()),
                },
                "timestamp": int(time.time() * 1000)
            }
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        pass
    # #endregion
    
    print(f"   -> VAPI CALLER: Executing call for {payload['customer']['name']}")
    try:
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "B",
                    "location": "main.py:trigger_vapi_call:before_api_call",
                    "message": "Before Vapi API call",
                    "data": {
                        "vapi_key_set": VAPI_Private_Key is not None,
                        "phone_number_id": payload.get('phoneNumberId', 'missing'),
                        "api_url": "https://api.vapi.ai/call/phone",
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        if not VAPI_Private_Key:
            # #region agent log
            try:
                with open(log_path, "a") as f:
                    log_entry = {
                        "sessionId": "debug-session",
                        "runId": "call-debug",
                        "hypothesisId": "C",
                        "location": "main.py:trigger_vapi_call:no_key",
                        "message": "VAPI_API_KEY missing",
                        "data": {},
                        "timestamp": int(time.time() * 1000)
                    }
                    f.write(json.dumps(log_entry) + "\n")
            except Exception as e:
                pass
            # #endregion
            print("❌ VAPI_API_KEY not configured")
            return False
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "K",
                    "location": "main.py:trigger_vapi_call:key_check",
                    "message": "VAPI_API_KEY format check",
                    "data": {
                        "key_exists": VAPI_Private_Key is not None,
                        "key_length": len(VAPI_Private_Key) if VAPI_Private_Key else 0,
                        "key_prefix": VAPI_Private_Key[:10] if VAPI_Private_Key and len(VAPI_Private_Key) > 10 else "too_short",
                        "key_suffix": VAPI_Private_Key[-10:] if VAPI_Private_Key and len(VAPI_Private_Key) > 10 else "too_short",
                        "payload_structure": {
                            "has_phoneNumberId": "phoneNumberId" in payload,
                            "has_customer": "customer" in payload,
                            "has_assistant": "assistant" in payload,
                            "assistant_has_model": "model" in payload.get("assistant", {}),
                            "assistant_has_functions": "functions" in payload.get("assistant", {}),
                            "assistant_has_firstMessage": "firstMessage" in payload.get("assistant", {}),
                            "assistant_model_provider": payload.get("assistant", {}).get("model", {}).get("provider", "missing"),
                            "assistant_model_name": payload.get("assistant", {}).get("model", {}).get("model", "missing"),
                        }
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        headers = { "Authorization": f"Bearer {VAPI_Private_Key}", "Content-Type": "application/json" }
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "D",
                    "location": "main.py:trigger_vapi_call:api_request",
                    "message": "Making Vapi API request",
                    "data": {
                        "url": "https://api.vapi.ai/call/phone",
                        "payload_size": len(json.dumps(payload)),
                        "has_phone_number_id": "phoneNumberId" in payload,
                        "phone_number_id_value": payload.get('phoneNumberId', 'missing'),
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        # Make actual Vapi API call
        response = requests.post("https://api.vapi.ai/call/phone", headers=headers, json=payload, timeout=30)
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "E",
                    "location": "main.py:trigger_vapi_call:api_response",
                    "message": "Vapi API response received",
                    "data": {
                        "status_code": response.status_code,
                        "response_text": response.text[:200] if response.text else "empty",
                        "success": response.status_code in [200, 201],
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        print(f"   -> Vapi API Response: {response.status_code}")
        
        if response.status_code in [200, 201]:
            response_data = response.json() if response.text else {}
            print(f"   -> ✅ Call initiated: {response_data.get('id', 'unknown')}")
            return True
        else:
            error_msg = response.text[:500] if response.text else "No error message"
            print(f"   -> ❌ Vapi API Error: {response.status_code} - {error_msg}")
            
            # #region agent log
            try:
                error_json = {}
                try:
                    error_json = response.json() if response.text else {}
                except:
                    pass
                
                with open(log_path, "a") as f:
                    log_entry = {
                        "sessionId": "debug-session",
                        "runId": "call-debug",
                        "hypothesisId": "M",
                        "location": "main.py:trigger_vapi_call:api_error",
                        "message": "Vapi API returned error",
                        "data": {
                            "status_code": response.status_code,
                            "error_message": error_msg,
                            "error_json": error_json,
                            "is_auth_error": response.status_code == 401,
                            "suggests_wrong_key_type": "private key" in error_msg.lower() or "public key" in error_msg.lower(),
                        },
                        "timestamp": int(time.time() * 1000)
                    }
                    f.write(json.dumps(log_entry) + "\n")
            except Exception as e:
                pass
            # #endregion
            
            return False
            
    except requests.exceptions.RequestException as e:
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "F",
                    "location": "main.py:trigger_vapi_call:exception",
                    "message": "Vapi API request exception",
                    "data": {
                        "error_type": type(e).__name__,
                        "error_message": str(e)[:200],
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e2:
            pass
        # #endregion
        print(f"❌ Vapi Call Failed: {e}")
        return False
    except Exception as e:
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "G",
                    "location": "main.py:trigger_vapi_call:general_exception",
                    "message": "General exception in trigger_vapi_call",
                    "data": {
                        "error_type": type(e).__name__,
                        "error_message": str(e)[:200],
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e2:
            pass
        # #endregion
        print(f"❌ Vapi Call Failed: {e}")
        return False


def process_outbound_calls(leads: list):
    """Iterates through leads and triggers a call for each."""
    for lead in leads:
        lead_name = lead.get('name')
        lead_phone = lead.get('phone_number')
        agency_id = lead.get('agency_id')
        
        print(f"   -> Dialing: {lead_name} ({lead_phone})")
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "H",
                    "location": "main.py:process_outbound_calls:building_payload",
                    "message": "Building Vapi payload for outbound call",
                    "data": {
                        "lead_name": lead_name,
                        "lead_phone": lead_phone,
                        "agency_id": agency_id,
                        "vapi_phone_number_id": os.environ.get("VAPI_PHONE_NUMBER_ID"),
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        # 1. BUILD VAPI PAYLOAD
        phone_number_id = os.environ.get("VAPI_PHONE_NUMBER_ID")
        if not phone_number_id:
            print(f"   -> ⚠️ WARNING: VAPI_PHONE_NUMBER_ID not set, call may fail")
            # #region agent log
            try:
                with open(log_path, "a") as f:
                    log_entry = {
                        "sessionId": "debug-session",
                        "runId": "call-debug",
                        "hypothesisId": "N",
                        "location": "main.py:process_outbound_calls:missing_phone_id",
                        "message": "VAPI_PHONE_NUMBER_ID not set",
                        "data": {},
                        "timestamp": int(time.time() * 1000)
                    }
                    f.write(json.dumps(log_entry) + "\n")
            except Exception as e:
                pass
            # #endregion
        
        # #region agent log
        try:
            with open(log_path, "a") as f:
                log_entry = {
                    "sessionId": "debug-session",
                    "runId": "call-debug",
                    "hypothesisId": "O",
                    "location": "main.py:process_outbound_calls:payload_complete",
                    "message": "Vapi payload built",
                    "data": {
                        "has_phone_number_id": phone_number_id is not None,
                        "phone_number_id_length": len(phone_number_id) if phone_number_id else 0,
                        "payload_keys": list(["phoneNumberId", "customer", "assistant", "metadata", "webhookUrl"]),
                        "webhook_url": f"{os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://app.thavon.io')}/api/webhooks/vapi",
                    },
                    "timestamp": int(time.time() * 1000)
                }
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            pass
        # #endregion
        
        # Build payload matching the working frontend structure
        vapi_payload = {
            "phoneNumberId": phone_number_id or "YOUR_TWILIO_PHONE_ID_FROM_VAPI",
            "customer": { 
                "number": str(lead_phone), 
                "name": lead_name 
            },
            "assistant": {
                "model": {
                    "provider": "openai",  # Match frontend (was "groq")
                    "model": "gpt-4o"  # Match frontend (was "llama-3-70b-versatile")
                },
                "systemPrompt": f"You are a Senior Agent calling {lead_name} about their property. Book an appointment.",
                "functions": [  # Add functions array (was missing)
                    {
                        "name": "bookAppointment",
                        "description": "Book the meeting.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "time": {"type": "string"},
                                "notes": {"type": "string"}
                            }
                        }
                    }
                ],
                "voice": { 
                    "provider": "cartesia", 
                    "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d" 
                },
                "firstMessage": f"Hi {lead_name}, this is the real estate team calling about your property. Do you have a minute?",  # Add firstMessage (was missing)
            },
            "metadata": {
                "agency_id": agency_id,
                "lead_id": lead.get('id'),
                "is_outbound": True
            },
            "webhookUrl": f"{os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://app.thavon.io')}/api/webhooks/vapi"
        }
        
        # 2. TRIGGER THE CALL
        call_success = trigger_vapi_call(vapi_payload)
        
        # 3. MOCK POST-CALL PROCESSING & FULFILLMENT (NEW INTEGRATION POINT)
        if call_success:
            # This data would normally come from Vapi's end-of-call webhook
            mock_summary = f"Thavon AI called {lead_name}. Handled objection on commission. Booked a tentative appointment."
            
            fub_key = get_agency_fub_key(agency_id)
            if fub_key:
                push_to_followup_boss(fub_key, lead_name, lead_phone, mock_summary)
            else:
                print(f"   -> FUB CHECK: No FUB Key found for Agency {agency_id}. Skipping fulfillment.")
        
        # Small delay to simulate calling time
        time.sleep(1)


# --- CALL RETRY LOGIC (NEW) ---

def process_call_retries(agency_id: str):
    """
    Processes pending call retries for unanswered calls.
    Checks the call_retries table for scheduled retries and triggers calls.
    """
    try:
        # Get pending retries that are due (scheduled_at <= now)
        now = datetime.now().isoformat()
        retries_response = supabase.table('call_retries').select('*, leads:lead_id(*), call_logs:call_id(*)').eq('agency_id', agency_id).eq('status', 'pending').lte('scheduled_at', now).limit(10).execute()
        
        retries = retries_response.data or []
        
        if not retries:
            print("   -> No pending retries to process")
            return
        
        print(f"   -> Processing {len(retries)} call retries...")
        
        for retry in retries:
            lead = retry.get('leads')
            if not lead:
                print(f"   -> ⚠️ Retry {retry['id']}: Lead not found, skipping")
                continue
            
            lead_name = lead.get('name')
            lead_phone = lead.get('phone_number')
            lead_id = lead.get('id')
            
            print(f"   -> Retrying call to {lead_name} ({lead_phone}) - Attempt {retry['retry_count']}")
            
            # Build Vapi payload for retry
            vapi_payload = {
                "phoneNumberId": os.environ.get("VAPI_PHONE_NUMBER_ID", "YOUR_TWILIO_PHONE_ID_FROM_VAPI"),
                "customer": { "number": lead_phone, "name": lead_name },
                "assistant": {
                    "model": { 
                        "provider": "groq", 
                        "model": "llama-3-70b-versatile" 
                    },
                    "systemPrompt": f"You are a Senior Agent calling {lead_name} about their property. This is a follow-up call. Book an appointment.",
                    "voice": { 
                        "provider": "cartesia", 
                        "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d" 
                    },
                },
                "metadata": {
                    "agency_id": agency_id,
                    "lead_id": lead_id,
                    "is_retry": True,
                    "retry_count": retry['retry_count']
                }
            }
            
            # Trigger the call
            call_success = trigger_vapi_call(vapi_payload)
            
            if call_success:
                # Mark retry as completed
                supabase.table('call_retries').update({
                    'status': 'completed',
                    'completed_at': datetime.now().isoformat()
                }).eq('id', retry['id']).execute()
                print(f"   -> ✅ Retry call initiated for {lead_name}")
            else:
                # Mark retry as failed
                supabase.table('call_retries').update({
                    'status': 'failed'
                }).eq('id', retry['id']).execute()
                print(f"   -> ❌ Retry call failed for {lead_name}")
            
            # Small delay between retries
            time.sleep(2)
            
    except Exception as e:
        print(f"❌ Error processing call retries: {e}")


# --- API ENDPOINTS ---

# --- INBOUND ENGINE (SPEED-TO-LEAD) ---
@app.post("/webhooks/inbound/{agency_id}")
async def handle_inbound_lead(agency_id: str, request: Request, background_tasks: BackgroundTasks):
    """
    Receives a lead from Zapier/Website and calls them IMMEDIATELY.
    """
    # 1. Parse Data
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Map common field names (Zapier sends different keys sometimes)
    name = data.get('name') or data.get('first_name') or data.get('Name') or "New Lead"
    phone = data.get('phone') or data.get('phone_number') or data.get('Phone')
    address = data.get('address') or data.get('Address') or "your inquiry"
    language = data.get('language') or data.get('preferred_language') or 'en'  # NEW: Language support
    
    if not phone:
        return {"status": "ignored", "reason": "No phone number provided"}

    print(f"🚀 INBOUND TRIGGER: Agency {agency_id} -> Lead {name} ({phone}) [Language: {language}]")

    # 2. Check Subscription (Security)
    # We query Supabase to make sure this agency is active
    agency = supabase.table('agencies').select('subscription_status').eq('id', agency_id).single().execute()
    
    if not agency.data or agency.data['subscription_status'] != 'active':
        print("❌ Call blocked: Inactive subscription")
        return {"status": "error", "message": "Subscription inactive"}

    # 3. Check Office Hours
    is_office_hours = is_within_office_hours(agency_id)
    
    # 4. Save Lead to Database with appropriate status
    lead_status = "calling_inbound" if is_office_hours else "queued_night"
    lead_data = {
        "agency_id": agency_id,
        "name": name,
        "phone_number": str(phone),
        "address": address,
        "status": lead_status,
        "asking_price": "0", # Not relevant for inbound usually
        "preferred_language": language  # NEW: Store language preference
    }
    lead_insert = supabase.table('leads').insert(lead_data).execute()
    lead_id = lead_insert.data[0]['id'] if lead_insert.data else None

    # 5. TRIGGER THE CALL (Only if within office hours)
    if not is_office_hours:
        print(f"🌙 Outside office hours - Lead {name} queued for next business day")
        return {"status": "queued", "lead": name, "message": "Lead saved and queued for next business day"}

    # We use a DIFFERENT script for inbound.
    inbound_prompt = f"""
    # IDENTITY
    You are the AI assistant for a top real estate agency. 
    You are calling {name} immediately because they just requested information about {address} on our website.
    
    # GOAL
    Confirm they made the request and ask if they are looking to buy or sell. 
    Your goal is to get a live agent on the line if they are serious.
    
    # LANGUAGE
    Speak in {language} if the lead prefers it. Adjust your communication style accordingly.
    
    # OPENER
    "Hi {name}, this is Thavon calling from the real estate team. I saw you just requested an estimate for {address}. Do you have a minute?"
    """

    call_payload = {
        # ... (Same structure as your existing outbound call, just different prompt)
        "phoneNumberId": os.environ.get("VAPI_PHONE_NUMBER_ID", "YOUR_TWILIO_PHONE_ID_FROM_VAPI"), 
        "customer": { "number": str(phone), "name": name },
        "assistant": {
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "systemPrompt": inbound_prompt,
                # Reuse your existing tools or make specific ones
                "functions": [
                    {
                        "name": "bookAppointment",
                        "description": "Book the meeting.",
                        "parameters": { "type": "object", "properties": { "time": {"type": "string"}, "notes": {"type": "string"} } }
                    }
                ]
            },
            "voice": { "provider": "cartesia", "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d" },
            "firstMessage": f"Hi {name}, this is the real estate team calling about your request. Do you have a minute?",
            "language": language  # NEW: Pass language to Vapi
        },
        "metadata": {
            "agency_id": agency_id,
            "lead_id": lead_id,
            "language": language,
            "is_inbound": True
        },
        "webhookUrl": f"{os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://app.thavon.io')}/api/webhooks/vapi"  # NEW: Webhook URL for call data
    }

    # 6. Execute Call (in background so we reply to Zapier instantly)
    # Add a 30-second delay before calling (as per requirements)
    def delayed_call():
        time.sleep(30)  # Wait 30 seconds before calling
        trigger_vapi_call(call_payload)
    
    background_tasks.add_task(delayed_call)

    return {"status": "calling", "lead": name, "message": "Call will be initiated in 30 seconds"}

@app.post("/start-campaign")
async def start_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    """
    Fetches leads ONLY for the specific agency requesting the campaign.
    Prioritizes queued_night leads (from outside office hours) before new leads.
    Also processes call retries.
    """
    # #region agent log
    try:
        with open(log_path, "a") as f:
            log_entry = {
                "sessionId": "debug-session",
                "runId": "call-debug",
                "hypothesisId": "I",
                "location": "main.py:start_campaign:entry",
                "message": "start_campaign endpoint called",
                "data": {
                    "agency_id": request.agency_id,
                    "has_vapi_key": VAPI_Private_Key is not None,
                    "vapi_phone_number_id": os.environ.get("VAPI_PHONE_NUMBER_ID"),
                },
                "timestamp": int(time.time() * 1000)
            }
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        pass
    # #endregion
    
    agency_id = request.agency_id
    
    # 1. Process call retries first (unanswered calls)
    background_tasks.add_task(process_call_retries, agency_id)
    
    # 2. Get Queued Night Leads First (Priority - from outside office hours)
    queued_response = supabase.table('leads').select("*").eq('status', 'queued_night').eq('agency_id', agency_id).limit(5).execute()
    queued_leads = queued_response.data or []
    
    # 3. Get New Leads (if we haven't reached the limit)
    remaining_slots = 5 - len(queued_leads)
    new_leads = []
    if remaining_slots > 0:
        new_response = supabase.table('leads').select("*").eq('status', 'new').eq('agency_id', agency_id).limit(remaining_slots).execute()
        new_leads = new_response.data or []
    
    # 4. Combine leads (queued_night first, then new)
    leads = queued_leads + new_leads
    
    if not leads:
        return {"message": "No leads found for your agency."}
    
    # 5. Update queued_night leads to 'new' status so they're processed
    if queued_leads:
        lead_ids = [lead['id'] for lead in queued_leads]
        supabase.table('leads').update({'status': 'new'}).in_('id', lead_ids).execute()
        print(f"📞 Processing {len(queued_leads)} queued night leads + {len(new_leads)} new leads")
    
    # #region agent log
    try:
        with open(log_path, "a") as f:
            log_entry = {
                "sessionId": "debug-session",
                "runId": "call-debug",
                "hypothesisId": "J",
                "location": "main.py:start_campaign:before_background_task",
                "message": "About to start background task for calls",
                "data": {
                    "leads_count": len(leads),
                    "queued_count": len(queued_leads),
                    "new_count": len(new_leads),
                },
                "timestamp": int(time.time() * 1000)
            }
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        pass
    # #endregion
    
    # 6. Loop and Call in the background
    background_tasks.add_task(process_outbound_calls, leads)
    
    return {"message": f"Started calling {len(leads)} leads ({len(queued_leads)} queued + {len(new_leads)} new). Processing retries in background."}

# Add a simple health check endpoint
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Thavon Python Backend is healthy."}
