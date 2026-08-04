import { router } from './core/router.js';

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
