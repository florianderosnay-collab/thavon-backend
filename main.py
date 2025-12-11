import os
import json
import requests
from fastapi import FastAPI, Request, BackgroundTasks
from supabase import create_client, Client
from dotenv import load_dotenv
from twilio.rest import Client as TwilioClient
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

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
async def start_campaign(background_tasks: BackgroundTasks):
    """
    Fetches all 'new' leads from Supabase and triggers calls via Vapi.
    """
    
    # 1. Get Leads
    response = supabase.table('leads').select("*").eq('status', 'new').limit(50).execute()
    leads = response.data
    
    if not leads:
        return {"message": "No new leads to call."}

    # 2. Loop and Call (Background Task to not block server)
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
