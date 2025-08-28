// Google login with Redirect (not popup)
document.getElementById("loginBtn").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithRedirect(provider);
});

firebase.auth().getRedirectResult()
  .then((result) => {
    if (result.user) {
      console.log("Signed in:", result.user.email);
    }
  })
  .catch((error) => {
    console.error("Redirect Error:", error);
  });

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log("[auth] state changed: logged in", user.email);
    document.body.classList.add("entered");
  } else {
    console.log("[auth] state changed: logged out");
    document.body.classList.remove("entered");
  }
});