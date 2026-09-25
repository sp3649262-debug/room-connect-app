import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# Credentials load karein
creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
client = gspread.authorize(creds)

# Exact Google Sheet name
SHEET_NAME = "RoomConnectDB"
sheet = client.open(SHEET_NAME).sheet1

def save_message(room_id: str, username: str, message: str):
    timestamp = datetime.utcnow().strftime("%H:%M")
    # Row append karna
    sheet.append_row([str(room_id), str(username), str(message), timestamp])

def get_recent_messages(room_id: str, limit: int = 50):
    try:
        all_rows = sheet.get_all_records()
        filtered = [
            {"user": row.get("username"), "text": row.get("message"), "time": row.get("timestamp")}
            for row in all_rows if str(row.get("room_id")) == str(room_id)
        ]
        return filtered[-limit:]
    except Exception as e:
        print(f"Error fetching history: {e}")
        return []