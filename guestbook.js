// Guestbook widget for the Contact page — talks to the Flask backend
// deployed on Render (see the separate `guestbook-backend` repo).
//
// TODO: after you deploy the backend to Render, replace this with your
// real Render URL, e.g. "https://oulan-guestbook-backend.onrender.com"
const BACKEND_URL = "http://127.0.0.1:5000";

(function () {
  const form = document.getElementById("guestbookForm");
  const nameInput = document.getElementById("gbName");
  const messageInput = document.getElementById("gbMessage");
  const statusEl = document.getElementById("guestbookStatus");
  const listEl = document.getElementById("guestbookList");

  if (!form) return; // guestbook markup isn't on this page

  function setStatus(text, state) {
    statusEl.textContent = text || "";
    if (state) {
      statusEl.setAttribute("data-state", state);
    } else {
      statusEl.removeAttribute("data-state");
    }
  }

  function formatTime(unixSeconds) {
    try {
      return new Date(unixSeconds * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function renderMessages(messages) {
    listEl.innerHTML = "";

    if (!messages || messages.length === 0) {
      const empty = document.createElement("li");
      empty.className = "guestbook-empty";
      empty.textContent = "No messages yet — be the first to sign.";
      listEl.appendChild(empty);
      return;
    }

    messages.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "guestbook-entry";

      const head = document.createElement("div");
      head.className = "guestbook-entry-head";

      const name = document.createElement("span");
      name.className = "guestbook-entry-name";
      name.textContent = entry.name; // textContent, never innerHTML — no injected HTML from visitors

      const time = document.createElement("span");
      time.className = "guestbook-entry-time";
      time.textContent = formatTime(entry.created_at);

      head.appendChild(name);
      head.appendChild(time);

      const message = document.createElement("p");
      message.className = "guestbook-entry-message";
      message.textContent = entry.message;

      li.appendChild(head);
      li.appendChild(message);
      listEl.appendChild(li);
    });
  }

  async function loadMessages() {
    try {
      const res = await fetch(`${BACKEND_URL}/messages`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      renderMessages(data.messages);
    } catch (err) {
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.className = "guestbook-empty";
      li.textContent =
        "Couldn't load the guestbook right now (the backend may be waking up — Render's free tier sleeps when idle). Try refreshing in a moment.";
      listEl.appendChild(li);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !message) {
      setStatus("Please fill in both your name and a message.", "error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    setStatus("Sending…", null);

    try {
      const res = await fetch(`${BACKEND_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Server responded with ${res.status}`);
      }

      form.reset();
      setStatus("Thanks — your message was added!", "ok");
      await loadMessages();
    } catch (err) {
      setStatus(`Couldn't send your message: ${err.message}`, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadMessages();
})();
