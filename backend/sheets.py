import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

sheet = None

def init_client():
    global sheet
    if sheet is not None:
        return sheet
    try:
        creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
        client = gspread.authorize(creds)
        sheet = client.open("RoomConnectDB").sheet1
        return sheet
    except Exception as e:
        print(f"[SHEETS AUTH WARNING]: {e}")
        return None

def save_message(room_id: str, username: str, message: str):
    active_sheet = init_client()
    if not active_sheet:
        return
    try:
        timestamp = datetime.utcnow().strftime("%H:%M")
        active_sheet.append_row([str(room_id), str(username), str(message), timestamp])
    except Exception as err:
        # Rate limit (Quota 429) aane par chat crash nahi hogi, console log ho jayegi
        print(f"[SHEET WRITE EXCEPTION]: {err}")

def get_recent_messages(room_id: str, limit: int = 50):
    active_sheet = init_client()
    if not active_sheet:
        return []
    try:
        all_rows = active_sheet.get_all_records()
        filtered = [
            {"user": row.get("username"), "text": row.get("message"), "time": row.get("timestamp")}
            for row in all_rows if str(row.get("room_id")) == str(room_id)
        ]
        return filtered[-limit:]
    except Exception as e:
        print(f"[SHEET READ ERROR]: {e}")
        return []
