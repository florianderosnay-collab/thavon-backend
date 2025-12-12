import os
import json
import requests
from fastapi import FastAPI, Request, BackgroundTasks
from supabase import create_client, Client
from dotenv import load_dotenv
from twilio.rest import Client as TwilioClient
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, BackgroundTasks, Request, HTTPException, Body


load_dotenv()

app = FastAPI()

from pydantic import BaseModel

class CampaignRequest(BaseModel):
    agency_id: str


# --- FIX CORS (ALLOW VERCEL TO TALK TO RAILWAY) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (Vercel, localhost, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- CONFIGURATION ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER")
VAPI_Private_Key = os.environ.get("VAPI_PRIVATE_KEY") # Get this from Vapi Dashboard

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN) if TWILIO_SID else None

# --- THE DISPATCHER ALGORITHM (High Ticket Feature) ---
def find_best_agent(zip_code=None):
    """
    1. Checks for Territory Specialist (Zip Code Match).
    2. If none, uses Round Robin (Random active agent).
    """
    print(f"Dispatching for Zip: {zip_code}")
    
    # 1. Check Territory
    if zip_code:
        response = supabase.table('agents').select("*").eq('territory_zip', zip_code).eq('is_active', True).execute()
        if response.data:
            print(f"Territory Match: {response.data[0]['name']}")
            return response.data[0]

    # 2. Round Robin (Fallback)
    # In a real app, you'd pick the one with least leads. For now, we pick the first active one.
    response = supabase.table('agents').select("*").eq('is_active', True).execute()
    if response.data:
        print(f"Round Robin Match: {response.data[0]['name']}")
        return response.data[0]
    
    return None

def send_agent_notification(agent_phone, lead_name, appointment_time):
    """
    The 'Double Tap': Sends BOTH WhatsApp and SMS to ensure the agent never misses a lead.
    """
    if not twilio_client:
        print("Twilio not configured.")
        return

    # --- 1. PREPARE MESSAGES ---
    
    # WhatsApp Message (Rich Text with Markdown)
    wa_body = (
        f"🚀 *THAVON ALERT: New Appointment!*\n\n"
        f"👤 *Lead:* {lead_name}\n"
        f"📅 *Time:* {appointment_time}\n"
        f"📍 *Action:* Check your calendar immediately."
    )

    # SMS Message (Plain Text, Short & Urgent)
    sms_body = f"URGENT: New Appointment booked with {lead_name} for {appointment_time}. Check Thavon Dashboard."

    # --- 2. SEND WHATSAPP ---
    try:
        # Ensure 'whatsapp:' prefix is there for the To and From numbers
        wa_to = f"whatsapp:{agent_phone}" if not agent_phone.startswith('whatsapp:') else agent_phone
        # Your Twilio WhatsApp Sender (e.g. whatsapp:+1415...)
        wa_from = f"whatsapp:{TWILIO_FROM}" if not TWILIO_FROM.startswith('whatsapp:') else TWILIO_FROM
        
        twilio_client.messages.create(
            body=wa_body,
            from_=wa_from,
            to=wa_to
        )
        print(f"✅ WhatsApp sent to {agent_phone}")
    except Exception as e:
        print(f"❌ WhatsApp Failed: {e}")

    # --- 3. SEND SMS (FAIL-SAFE) ---
    try:
        # Ensure 'whatsapp:' prefix is REMOVED for SMS
        sms_to = agent_phone.replace("whatsapp:", "")
        # Your Twilio SMS Number (Standard E.164)
        sms_from = TWILIO_FROM.replace("whatsapp:", "")
        
        twilio_client.messages.create(
            body=sms_body,
            from_=sms_from,
            to=sms_to
        )
        print(f"✅ SMS sent to {agent_phone}")
    except Exception as e:
        print(f"❌ SMS Failed: {e}")

        
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


@app.get("/")
def health():
    return {"status": "Thavon Enterprise Online"}

# 1. THE BRAIN (Inbound & Outbound Logic)
@app.post("/assistant-request")
async def assistant_request(request: Request):
    payload = await request.json()
    message = payload.get('message', {})
    
    if message.get('type') != 'assistant-request':
        return {"status": "ignored"}

    call = message.get('call', {})
    phone_number = call.get('customer', {}).get('number')
    
    # -- DB LOOKUP --
    lead_name = "there"
    address = "your property"
    zip_code = None
    
    if phone_number:
        data = supabase.table('leads').select("*").eq('phone_number', phone_number).execute()
        if data.data:
            lead = data.data[0]
            lead_name = lead.get('name', "there")
            address = lead.get('address', "the property")
            # Assume address format "123 Main St, 8001 Luxembourg" -> extract 8001
            # Simple extraction logic for demo:
            zip_code = "8001" if "8001" in address else None

    # -- THE ENTERPRISE PROMPT --
    system_prompt = f"""
    # IDENTITY
    You are Thavon, a Senior Agent at Century 21. 
    You are speaking to {lead_name}.
    Regarding: {address}.
    
    # GOAL
    Book a 15-minute Discovery Visit.
    
    # BEHAVIOR
    - Fast, professional, confident.
    - If they speak Luxembourgish, reply in French but acknowledge understanding.
    - If user asks about price/commission: "We have flexible net-sheet options, including 0% commission structures. I can explain in 10 minutes."
    
    # TOOLS
    - You have a tool called 'bookAppointment'. USE IT when they agree to a time.
    """

    return {
        "assistant": {
            "firstMessage": f"Hello {lead_name}, it's Thavon calling about {address}. Is this a good time?",
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "systemPrompt": system_prompt,
                "functions": [
                    {
                        "name": "bookAppointment",
                        "description": "Book the meeting and notify the agent.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "time": {"type": "string", "description": "The agreed time (e.g. Tuesday 2pm)"},
                                "notes": {"type": "string", "description": "Any specific notes from the user"}
                            }
                        }
                    }
                ]
            },
            "voice": {
                "provider": "cartesia",
                "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d", # Use Cartesia for 300ms latency
                "model": "sonic-english"
            }
        }
    }

# 2. THE HANDS (Tool Execution - Dispatcher)
@app.post("/tool-call")
async def tool_call(request: Request):
    payload = await request.json()
    message = payload.get('message', {})
    
    # --- CRITICAL FIX: Ignore non-tool messages ---
    if message.get('type') != 'tool-calls':
        print(f"Ignored event type: {message.get('type')}")
        return {"status": "ignored"}
    
    # Safely get the first tool call
    tool_calls = message.get('toolCalls', [])
    if not tool_calls:
        return {"status": "no tool calls found"}
        
    function_call = tool_calls[0]
    function_name = function_call.get('function', {}).get('name')
    args = json.loads(function_call.get('function', {}).get('arguments', '{}'))
    call_id = function_call.get('id') # Important for the response
    
    print(f"🛠️ Tool Triggered: {function_name}")
    
    if function_name == "bookAppointment":
        time = args.get('time')
        
        # --- DISPATCHER LOGIC ---
        # 1. Find the best agent
        agent = find_best_agent(zip_code="8001") 
        
        if agent:
            # 2. Notify the Agent (Double Tap)
            send_agent_notification(agent['phone_number'], "FSBO Lead", time)
            
            # 3. Return success to Vapi
            return {
                "results": [
                    {
                        "toolCallId": call_id,
                        "result": f"Great. I've assigned my senior partner {agent['name']} to meet you at {time}. You'll get a text confirmation."
                    }
                ]
            }
        else:
             return {
                "results": [
                    {
                        "toolCallId": call_id,
                        "result": "Confirmed. I have booked that time for you."
                    }
                ]
            }

    return {"results": [{"toolCallId": call_id, "result": "Function not found"}]}

# 3. THE TRIGGER (Outbound Campaign)
# Call this endpoint to start calling 100 people
@app.post("/start-campaign")
async def start_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    """
    Fetches leads ONLY for the specific agency requesting the campaign.
    """
    agency_id = request.agency_id
    print(f"🚀 Starting campaign for Agency ID: {agency_id}")

    # 1. Get Leads (Filtered by Agency ID)
    # We add .eq('agency_id', agency_id) to ensure strict privacy
    response = supabase.table('leads').select("*").eq('status', 'new').eq('agency_id', agency_id).limit(50).execute()
    leads = response.data
    
    if not leads:
        print("No leads found.")
        return {"message": "No new leads found for your agency."}

    # 2. Loop and Call
    background_tasks.add_task(process_outbound_calls, leads)
    
    return {"message": f"Started calling {len(leads)} leads."}

def process_outbound_calls(leads):
    """
    Loops through leads and sends a FULLY CONFIGURED assistant to Vapi.
    This bypasses the need for the server to look up the lead again.
    """
    headers = {
        "Authorization": f"Bearer {VAPI_Private_Key}",
        "Content-Type": "application/json"
    }
    
    for lead in leads:
        print(f"Dialing {lead['name']}...")
        
        # 1. GENERATE SCRIPT LOCALLY
        # We have the data right here, so let's use it.
        system_prompt = f"""
        # IDENTITY
        You are Thavon, a Senior Agent at Century 21. 
        You are speaking to {lead['name']}.
        Regarding: {lead['address']}.
        
        # GOAL
        Book a 15-minute Discovery Visit.
        
        # BEHAVIOR
        - Fast, professional, confident.
        - If they speak Luxembourgish, reply in French but acknowledge understanding.
        
        # OBJECTION HANDLING
        - "No agents": "I respect that. I'm not asking for a listing. I have buyers looking in {lead['address']} and need to verify the layout."
        - "Bring a buyer": "I'd love to, but I need to see it first to ensure it matches their criteria. Takes 10 mins."
        """

        # 2. CREATE CALL PAYLOAD (Direct Injection)
        data = {
            "phoneNumberId": "be9abf77-a526-447e-8259-9d864243c857", # <--- VERIFY THIS ID IS CORRECT
            "customer": {
                "number": lead['phone_number'],
                "name": lead['name']
            },
            "assistant": {
                # We pass the prompt DIRECTLY. No lookup needed.
                "model": {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "systemPrompt": system_prompt,
                    # Define tools here so they still work
                    "functions": [
                        {
                            "name": "bookAppointment",
                            "description": "Book the meeting.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "time": {"type": "string", "description": "The agreed time"},
                                    "notes": {"type": "string"}
                                }
                            }
                        }
                    ]
                },
                # Keep the fast voice
                "voice": {
                    "provider": "cartesia",
                    "voiceId": "248be419-c632-4f23-adf1-5324ed7dbf1d",
                    "model": "sonic-english"
                },
                "firstMessage": f"Hello {lead['name']}, it's Thavon. I'm calling about {lead['address']}. Do you have a minute?",
                # IMPORTANT: Point back to our server for Tool Execution (Booking)
                "serverUrl": "https://web-production-274e.up.railway.app/tool-call" 
            }
        }
        
        try:
            response = requests.post("https://api.vapi.ai/call/phone", headers=headers, json=data)
            print(f"Call Status: {response.status_code} - {response.text}")
            
            # Update DB
            supabase.table('leads').update({'status': 'dialing'}).eq('id', lead['id']).execute()
        except Exception as e:
            print(f"Failed to call {lead['name']}: {e}")
