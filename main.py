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
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # We use the Service Role Key for secure backend calls

# --- INITIALIZATION ---
app = FastAPI()
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