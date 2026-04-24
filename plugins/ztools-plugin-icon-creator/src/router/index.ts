import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'icon-creator',
      component: () => import('@/views/home/index.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'icon-creator' }
    }
  ]
})

export default router
