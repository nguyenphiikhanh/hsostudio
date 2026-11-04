<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({ layers: { type: Array, required: true } })
const emit = defineEmits(['close'])
const host = ref(null), dialog = ref(null), loading = ref(true), error = ref('')
const state = ref({ hp: 100, kills: 0, mode: 'ready', x: 640, y: 450, elapsed: 0 })
let controller, disposed = false
const labels = { ready: 'Bãi tập đã sẵn sàng', paused: 'Đã tạm dừng', won: 'Hoàn thành bãi tập!', lost: 'Nhân vật đã gục ngã' }
const summary = computed(() => labels[state.value.mode] || 'Hạ 5 slime để hoàn thành bãi tập')
function start() { controller?.start() }
function pause() { controller?.pause() }
function restart() { controller?.restart() }
onMounted(async () => {
  dialog.value.showModal()
  try {
    const { createPlayableGame } = await import('../game/createGame')
    if (disposed) return
    controller = await createPlayableGame(host.value, JSON.parse(JSON.stringify(props.layers)), value => { if (!disposed) state.value = value })
    if (disposed) controller.destroy()
    else loading.value = false
  } catch (e) { if (!disposed) { error.value = e.message; loading.value = false } }
})
onUnmounted(() => { disposed = true; controller?.destroy() })
</script>

<template>
  <dialog ref="dialog" class="game-dialog" aria-label="Chơi thử H5 một người" @cancel.prevent="pause" @keydown.esc.prevent="pause">
    <header class="game-header"><div><p class="eyebrow">H5 PLAYTEST · SINGLE PLAYER</p><h2>Bãi tập tân thủ</h2></div><button @click="emit('close')">Đóng bản chơi thử</button></header>
    <div class="game-hud" data-testid="game-state" :data-mode="state.mode" :data-x="state.x" :data-y="state.y" :data-hp="state.hp" :data-kills="state.kills"><strong>HP {{ state.hp }}/100</strong><progress :value="state.hp" max="100" aria-label="Máu nhân vật"></progress><span>Slime {{ state.kills }}/5</span><span>{{ state.elapsed }}s</span><button v-if="state.mode === 'playing'" @click="pause">Tạm dừng game</button><button :disabled="loading" @click="restart">Chơi lại</button></div>
    <div class="game-canvas-wrap"><div ref="host" class="game-host"></div><div v-if="loading || error || state.mode !== 'playing'" class="game-overlay"><h2>{{ error ? 'Không mở được bản chơi thử' : loading ? 'Đang chuẩn bị nhân vật…' : summary }}</h2><p v-if="error" role="alert">{{ error }}</p><template v-else-if="!loading"><p>WASD / phím mũi tên để di chuyển · Space để đánh</p><button v-if="state.mode === 'ready' || state.mode === 'paused'" class="primary" @click="start">{{ state.mode === 'paused' ? 'Tiếp tục game' : 'Bắt đầu game' }}</button><button v-else class="primary" @click="restart">Thử lại</button></template></div></div>
    <footer class="game-help"><strong>{{ summary }}</strong><p>WASD / mũi tên: di chuyển 8 hướng · Space: đánh quái gần nhất · Esc: tạm dừng</p><p>Nhân vật dùng bộ part bạn đang chọn trong Studio. Sprite hiển thị 4 hướng; bản đồ và slime là mẫu thử dựng riêng. Tiến trình chỉ tồn tại trong lần chơi này.</p></footer>
  </dialog>
</template>
