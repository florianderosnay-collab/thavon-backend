# main.py content (Updated to include FUB Fulfillment)

from fastapi import FastAPI, BackgroundTasks, HTTPException, Body
from pydantic import BaseModel
import requests
from supabase import create_client, Client
import json
import os
import time # For mocking delay

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins (Vercel, localhost, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class CampaignRequest(BaseModel):
    agency_id: str

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
    print(f"   -> VAPI CALLER: Executing call for {payload['customer']['name']}")
    try:
        headers = { "Authorization": f"Bearer {VAPI_Private_Key}", "Content-Type": "application/json" }
        # Simulate a real call API endpoint (Vapi handles the call)
        # response = requests.post("https://api.vapi.ai/call/phone", headers=headers, json=payload)
        # print(f"   -> Vapi API Response: {response.status_code}")
        
        # MOCK CALL SUCCESS & POST-CALL WEBHOOK DATA
        # Simulate that Vapi finished the call and sent the summary back to our server
        return True
    except Exception as e:
        print(f"Vapi Call Failed: {e}")
        return False


def process_outbound_calls(leads: list):
    """Iterates through leads and triggers a call for each."""
    for lead in leads:
        lead_name = lead.get('name')
        lead_phone = lead.get('phone_number')
        agency_id = lead.get('agency_id')
        
        print(f"   -> Dialing: {lead_name} ({lead_phone})")
        
        # 1. BUILD VAPI PAYLOAD (Simplified Mock)
        vapi_payload = {
            "phoneNumberId": "YOUR_TWILIO_PHONE_ID_FROM_VAPI", 
            "customer": { "number": lead_phone, "name": lead_name },
            "assistant": {
                # ... (Simplified Assistant for demo)
                "model": { "provider": "groq", "model": "llama-3-70b-versatile" },
                "systemPrompt": f"You are a Senior Agent calling {lead_name} about their property. Book an appointment.",
                "voice": { "provider": "cartesia", "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d" },
            },
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
    
    if not phone:
        return {"status": "ignored", "reason": "No phone number provided"}

    print(f"🚀 INBOUND TRIGGER: Agency {agency_id} -> Lead {name} ({phone})")

    # 2. Check Subscription (Security)
    # We query Supabase to make sure this agency is active
    agency = supabase.table('agencies').select('subscription_status').eq('id', agency_id).single().execute()
    
    if not agency.data or agency.data['subscription_status'] != 'active':
        print("❌ Call blocked: Inactive subscription")
        return {"status": "error", "message": "Subscription inactive"}

    # 3. Save Lead to Database (Mark as 'called' immediately or 'inbound')
    lead_data = {
        "agency_id": agency_id,
        "name": name,
        "phone_number": str(phone),
        "address": address,
        "status": "calling_inbound", 
        "asking_price": "0" # Not relevant for inbound usually
    }
    supabase.table('leads').insert(lead_data).execute()

    # 4. TRIGGER THE CALL (Immediate)
    # We use a DIFFERENT script for inbound.
    inbound_prompt = f"""
    # IDENTITY
    You are the AI assistant for a top real estate agency. 
    You are calling {name} immediately because they just requested information about {address} on our website.
    
    # GOAL
    Confirm they made the request and ask if they are looking to buy or sell. 
    Your goal is to get a live agent on the line if they are serious.
    
    # OPENER
    "Hi {name}, this is Thavon calling from the real estate team. I saw you just requested an estimate for {address}. Do you have a minute?"
    """

    call_payload = {
        # ... (Same structure as your existing outbound call, just different prompt)
        "phoneNumberId": "YOUR_TWILIO_PHONE_ID_FROM_VAPI", 
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
        }
    }

    # Execute Call (in background so we reply to Zapier instantly)
    background_tasks.add_task(trigger_vapi_call, call_payload)

    return {"status": "calling", "lead": name}

def trigger_vapi_call(payload):
    try:
        headers = { "Authorization": f"Bearer {VAPI_Private_Key}", "Content-Type": "application/json" }
        requests.post("https://api.vapi.ai/call/phone", headers=headers, json=payload)
    except Exception as e:
        print(f"Vapi Call Failed: {e}")

@app.post("/start-campaign")
async def start_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    """
    Fetches leads ONLY for the specific agency requesting the campaign.
    """
    agency_id = request.agency_id
    
    # 1. Get Leads (Filtered by Agency ID)
    response = supabase.table('leads').select("*").eq('status', 'new').eq('agency_id', agency_id).limit(5).execute() # Limit to 5 for fast demo
    leads = response.data
    
    if not leads:
        return {"message": "No new leads found for your agency."}
    
    # 2. Loop and Call in the background
    background_tasks.add_task(process_outbound_calls, leads)
    
    return {"message": f"Started calling {len(leads)} leads."}

# Add a simple health check endpoint
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Thavon Python Backend is healthy."}