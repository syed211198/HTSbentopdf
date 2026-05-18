import { createIcons, icons } from 'lucide';

function initIcons() {
  try {
    if (icons && Object.keys(icons).length > 0) {
      createIcons({ icons });
    }
  } catch (error) {
    console.error('Failed to initialize lucide icons:', error);
  }
}

// Run initially
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
});

// Run periodically for dynamically added elements
setInterval(() => {
  initIcons();
}, 500);
