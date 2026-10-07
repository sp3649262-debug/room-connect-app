# 💬 Room Connect — Disposable Real-Time Messaging

A high-performance ephemeral room chat application with full-duplex communication and zero sign-up friction.

## 🚀 Key Architectural Highlights
- **Full-Duplex WebSockets:** Sub-second bidirectional messaging powered by FastAPI.
- **In-Memory Connection Management:** Isolated room state management and automated username collision handling.
- **Non-blocking Event Loop:** Google Sheets logging handled via `asyncio.to_thread` to prevent thread pool starvation.
- **Mobile-First UX:** Debounced typing status indicators, dynamic invite link deep linking, and viewport adjustments for mobile keyboards.

## 🛠 Tech Stack
- **Backend:** FastAPI, WebSockets, Python, gspread
- **Frontend:** HTML5, CSS3, JavaScript
