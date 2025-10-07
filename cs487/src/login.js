import "./style.css"
const authForm = document.getElementById("authForm");
const toggleButton = document.getElementById("toggleButton")
const formTitle = document.getElementById("formTitle")
const submitButton = document.getElementById("submitButton")
const toggleText = document.getElementById("toggleText")

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
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (isLogin) {
    const user = await login(username, password);
    if (!user.error) {
        window.currentUser = user;
        startGame(user);  // only login starts game
    } 
      
  } else {
    const result = await signup(username, password);
    if (result.error) {
      alert(result.error);
    } else {
      alert("Sign up successful! Please log in.");
      toggleButton.click();
    }
  }
});

// Start Phaser game after successful login/signup
function startGame(user) {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("gamePage").style.display = "block";

    window.currentUser = user;

    // Initialize Phaser game
    import('./main.js').then(module => {
        module.startGame(user);
    });
}
