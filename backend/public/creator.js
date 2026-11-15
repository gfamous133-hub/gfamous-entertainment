"use strict";

const form = document.querySelector("#creatorForm");
const result = document.querySelector("#result");

form.addEventListener("submit", async event => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  result.textContent = "Sending submission…";
  result.classList.remove("error");
  const values = new FormData(form);
  const payload = {
    type: values.get("type"),
    title: values.get("title"),
    creatorName: values.get("creatorName"),
    description: values.get("description"),
    mediaUrl: values.get("mediaUrl"),
    rightsDetails: values.get("rightsDetails"),
    rightsConfirmed: values.get("rightsConfirmed") === "on"
  };
  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not submit. Try again.");
    form.reset();
    result.textContent = data.message;
  } catch (error) {
    result.textContent = error.message;
    result.classList.add("error");
  } finally {
    button.disabled = false;
  }
});
