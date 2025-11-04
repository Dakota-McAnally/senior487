import "./style.css"
const authForm = document.getElementById("authForm");
const toggleButton = document.getElementById("toggleButton")
const formTitle = document.getElementById("formTitle")
const submitButton = document.getElementById("submitButton")
const toggleText = document.getElementById("toggleText")
const authMessage = document.getElementById("authMessage")

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

let isLogin = true;

toggleButton.addEventListener("click", (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    formTitle.textContent = isLogin ? "Login" : "Sign Up";
    submitButton.textContent = isLogin ? "Login" : "Sign Up";
    toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    toggleButton.textContent = isLogin ? "Sign Up" : "Login";
});

async function login(username, password) {
    console.log("Login button clicked, user: ", username);
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    return res.json();
}

async function signup(username, password) {
    const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    return res.json();
}

//Login/Signup
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    showAuthMessage("Please fill out all fields.", "error");
    return;
  }

  if (isLogin) {
    const user = await login(username, password);
    if (user.error) {
      showAuthMessage(user.error, "error");
    } else {
      showAuthMessage("Login successful! Loading game...", "success");
      setTimeout(() => startGame(user), 800);
    }
  } else {
    const result = await signup(username, password);
    if (result.error) {
      showAuthMessage(result.error, "error");
    } else {
      showAuthMessage("Sign up successful! Please log in.", "success");
      setTimeout(() => toggleButton.click(), 1000);
    }
  }
});

function showAuthMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.className = "auth-message"; 
  if (type === "error") {
    authMessage.classList.add("error");
  } else if (type === "success") authMessage.classList.add("success"); {
      authMessage.style.opacity = message ? 1 : 0;
  }
}

// Start Phaser game after successful login/signup
function startGame(user) {
  const authWrapper = document.getElementById("authWrapper");
  const gameWrapper = document.getElementById("gameWrapper");
  const gameContainer = document.getElementById("gameContainer");
  authWrapper.style.display = "none";

  gameWrapper.classList.remove("hidden");

  window.currentUser = user;

  import("./main.js").then(mod => {
    mod.startGame(user);

    const check = setInterval(() => {
      const canvas = gameContainer.querySelector("canvas");
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        clearInterval(check);
        gameContainer.style.removeProperty("display");
        gameContainer.classList.add("visible");
      }
    }, 100);
  });
}
