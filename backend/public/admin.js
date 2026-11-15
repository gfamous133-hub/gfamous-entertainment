"use strict";

const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const submissions = document.querySelector("#submissions");
const statusBox = document.querySelector("#status");

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function cardFor(item) {
  const article = document.createElement("article");
  article.className = "submission";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const meta = document.createElement("p");
  meta.className = "muted";
  meta.textContent = item.type.toUpperCase() + " · " + item.creatorName + " · " + new Date(item.submittedAt).toLocaleString();
  const description = document.createElement("p");
  description.textContent = item.description;
  const rightsTitle = document.createElement("strong");
  rightsTitle.textContent = "Creator's rights declaration";
  const rights = document.createElement("p");
  rights.textContent = item.rightsDetails;
  const link = document.createElement("p");
  if (item.mediaUrl) {
    const anchor = document.createElement("a");
    anchor.href = item.mediaUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = "Open submitted media link";
    link.append(anchor);
  } else {
    link.textContent = "No media link supplied.";
  }
  const actions = document.createElement("div");
  actions.className = "actions";
  for (const [label, value, className] of [["Approve", "approved", "primary"], ["Reject", "rejected", "danger"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api("/api/admin/submissions/" + encodeURIComponent(item._id), {
          method: "PATCH",
          body: JSON.stringify({ status: value })
        });
        await loadPending();
        showStatus("Submission " + value + ".");
      } catch (error) {
        button.disabled = false;
        showStatus(error.message, true);
      }
    });
    actions.append(button);
  }
  article.append(title, meta, description, rightsTitle, rights, link, actions);
  return article;
}

async function loadPending() {
  const data = await api("/api/admin/pending");
  submissions.replaceChildren();
  if (!data.submissions.length) {
    const empty = document.createElement("p");
    empty.className = "panel muted";
    empty.textContent = "No submissions are waiting for review.";
    submissions.append(empty);
    return;
  }
  data.submissions.forEach(item => submissions.append(cardFor(item)));
}

function setSignedIn(signedIn) {
  loginPanel.hidden = signedIn;
  dashboard.hidden = !signedIn;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  try {
    const form = new FormData(loginForm);
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
    });
    loginForm.reset();
    setSignedIn(true);
    await loadPending();
    showStatus("Signed in. Review each rights declaration before approving.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh").addEventListener("click", async () => {
  try { await loadPending(); showStatus("Submissions refreshed."); }
  catch (error) { showStatus(error.message, true); }
});

document.querySelector("#logout").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    setSignedIn(false);
    submissions.replaceChildren();
    showStatus("You have signed out.");
  } catch (error) { showStatus(error.message, true); }
});

(async function init() {
  try {
    const session = await api("/api/admin/session");
    setSignedIn(session.authenticated);
    if (session.authenticated) await loadPending();
  } catch {
    setSignedIn(false);
    showStatus("Backend is not connected yet. Admin tools become available after backend deployment.", true);
  }
})();
