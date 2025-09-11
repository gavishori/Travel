// Basic demo toggling between list and gallery + no-wrap safety
const listBtn = document.getElementById('btnList');
const galleryBtn = document.getElementById('btnGallery');
const listView = document.getElementById('listView');
const galleryView = document.getElementById('galleryView');
const sortBtn = document.getElementById('btnSort');

if (listBtn && galleryBtn) {
  listBtn.addEventListener('click', () => {
    listView.hidden = false;
    galleryView.hidden = true;
  });
  galleryBtn.addEventListener('click', () => {
    listView.hidden = true;
    galleryView.hidden = false;
  });
}

if (sortBtn) {
  sortBtn.addEventListener('click', () => {
    // placeholder for sort handler
    alert('מיון לפי תאריך יציאה (דמו)');
  });
}
