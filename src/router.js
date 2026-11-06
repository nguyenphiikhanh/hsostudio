import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'character-lab' } },
    { path: '/character-lab', name: 'character-lab', component: () => import('./views/CharacterLabView.vue'), meta: { title: 'Character Lab' } },
    { path: '/catalog', name: 'catalog', component: () => import('./views/CatalogView.vue'), meta: { title: 'Thư viện dữ liệu' } },
    { path: '/maps', name: 'maps', component: () => import('./views/MapView.vue'), meta: { title: 'Map' } },
    { path: '/:pathMatch(.*)*', redirect: '/character-lab' },
  ],
  scrollBehavior(_to, _from, savedPosition) { return savedPosition || { left: 0, top: 0 } },
})
