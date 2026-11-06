import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

router.afterEach(to => { document.title = `${to.meta.title || 'Studio'} · HSO Studio` })
createApp(App).use(router).mount('#app')
