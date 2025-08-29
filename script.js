document.addEventListener("DOMContentLoaded", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  const loginBtn = document.getElementById("googleLogin");
  const splash = document.getElementById("splash");
  const app = document.getElementById("app");

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log("[auth] state changed: true");
      console.log("Auth UID:", user.uid);
      splash.style.display = "none";
      app.style.display = "block";
    } else {
      console.log("[auth] state changed: false");
      splash.style.display = "block";
      app.style.display = "none";
    }
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      firebase.auth().signInWithRedirect(provider);
    });
  }
});