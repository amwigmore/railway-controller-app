import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// ✅ Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

// ✅ (Optional) Import Bootstrap JS if using components like modals or tooltips
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
createApp(App).mount('#app')
