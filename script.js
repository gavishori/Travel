// Toggle password visibility
document.addEventListener('click', (e) => {
  if(e.target.closest('.toggle-password')){
    const field = e.target.closest('.field.password');
    const input = field.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
  }
});
