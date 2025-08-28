// Google login with Redirect (not popup)
document.getElementById("loginBtn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithRedirect(provider);
});

firebase.auth().getRedirectResult()
  .then((result) => {
    if (result.user) {
      console.log("Signed in:", result.user.email);
      window.location.href = "/Travel/home.html";
    }
  })
  .catch((error) => {
    console.error("Redirect Error:", error);
  });