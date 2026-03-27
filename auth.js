import { FB, hardSignOut } from './firebase.js';
import { state } from './state.js';

export function initAuth(onChange) {
  if (!FB?.onAuthStateChanged || !FB?.auth) return () => {};
  return FB.onAuthStateChanged(FB.auth, (user) => {
    state.user = user || null;
    if (typeof onChange === 'function') onChange(user || null);
  });
}

export async function loginWithEmail(email, password) {
  return FB.signInWithEmailAndPassword(FB.auth, email, password);
}

export async function registerWithEmail(email, password) {
  return FB.createUserWithEmailAndPassword(FB.auth, email, password);
}

export async function handleLogout() {
  await hardSignOut();
}
