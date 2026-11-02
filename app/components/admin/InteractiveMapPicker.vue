<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';
import type { WorldTrack } from '~/types/user';
import type { StageData, StageMapPosition } from '~/types/game';

interface Props {
  modelValue: StageMapPosition;
  worldTrack: WorldTrack;
  existingStages?: StageData[];
  currentStageId?: number;
  stageTitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  existingStages: () => [],
  currentStageId: 0,
  stageTitle: 'Chặng mới',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: StageMapPosition): void;
}>();

const containerRef = useTemplateRef<HTMLDivElement>('mapCanvasContainer');
const isDragging = ref(false);

const otherStages = computed(() =>
  props.existingStages.filter((s) => s.stageId !== props.currentStageId)
);

function updatePositionFromEvent(e: MouseEvent) {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const rawX = ((e.clientX - rect.left) / rect.width) * 100;
  const rawY = ((e.clientY - rect.top) / rect.height) * 100;

  const clampedX = Math.max(5, Math.min(95, Math.round(rawX)));
  const clampedY = Math.max(5, Math.min(95, Math.round(rawY)));

  emit('update:modelValue', { x: clampedX, y: clampedY });
}

function handleCanvasClick(e: MouseEvent) {
  updatePositionFromEvent(e);
}

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  updatePositionFromEvent(e);

  function onMouseMove(moveEvent: MouseEvent) {
    if (!isDragging.value) return;
    updatePositionFromEvent(moveEvent);
  }

  function onMouseUp() {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function handleManualInput(axis: 'x' | 'y', val: number) {
  const clamped = Math.max(5, Math.min(95, Math.round(val || 5)));
  emit('update:modelValue', {
    ...props.modelValue,
    [axis]: clamped,
  });
}
</script>

<template>
  <div class="map-picker-wrapper">
    <div class="map-header">
      <span class="label">Tọa Độ Bản Đồ (Map Position)</span>
      <span class="instruction">Click hoặc kéo ghim trên bản đồ để định vị chặng</span>
    </div>

    <!-- Visual Canvas Area -->
    <div
      ref="mapCanvasContainer"
      class="map-canvas"
      :class="`theme-${worldTrack}`"
      @click="handleCanvasClick"
    >
      <!-- Grid overlay -->
      <div class="grid-lines"></div>

      <!-- Other existing stage pins for reference -->
      <div
        v-for="s in otherStages"
        :key="s.stageId"
        class="stage-pin ref-pin"
        :style="{ left: `${s.mapPosition.x}%`, top: `${s.mapPosition.y}%` }"
        :title="`Chặng ${s.stageId}: ${s.title}`"
      >
        <span class="pin-marker">{{ s.stageId }}</span>
      </div>

      <!-- Current Active Pin -->
      <div
        class="stage-pin active-pin"
        :style="{ left: `${modelValue.x}%`, top: `${modelValue.y}%` }"
        @mousedown.stop="startDrag"
      >
        <div class="pin-pulse"></div>
        <div class="active-marker">
          <span>📍</span>
          <span class="active-badge">{{ currentStageId || 'NEW' }}</span>
        </div>
        <div class="pin-tooltip">
          <strong>{{ stageTitle || 'Chặng mới' }}</strong>
          <span>({{ modelValue.x }}%, {{ modelValue.y }}%)</span>
        </div>
      </div>
    </div>

    <!-- Fine-tuning number inputs -->
    <div class="coordinates-bar">
      <div class="coord-input-group">
        <label>Tọa độ ngang X (%):</label>
        <input
          type="number"
          min="5"
          max="95"
          :value="modelValue.x"
          @input="handleManualInput('x', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="coord-input-group">
        <label>Tọa độ dọc Y (%):</label>
        <input
          type="number"
          min="5"
          max="95"
          :value="modelValue.y"
          @input="handleManualInput('y', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="coord-preview-pill">
        <span>Vị trí hiện tại:</span>
        <strong>x: {{ modelValue.x }}%, y: {{ modelValue.y }}%</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-picker-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.map-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.label {
  font-size: 13px;
  font-weight: 700;
  color: #cbd5e1;
}

.instruction {
  font-size: 11px;
  color: #64748b;
}

/* Map Canvas */
.map-canvas {
  position: relative;
  width: 100%;
  height: 280px;
  border-radius: 14px;
  overflow: hidden;
  cursor: crosshair;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.6);
  user-select: none;
}

/* Universe Themes */
.theme-kids {
  background: radial-gradient(circle at 50% 50%, #064e3b 0%, #022c22 100%);
  border-color: rgba(245, 158, 11, 0.3);
}

.theme-teens {
  background: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0f172a 100%);
  border-color: rgba(139, 92, 246, 0.4);
}

.theme-adults {
  background: radial-gradient(circle at 50% 50%, #0c4a6e 0%, #082f49 100%);
  border-color: rgba(56, 189, 248, 0.4);
}

/* Grid lines */
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Pin Base */
.stage-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: grab;
}

/* Ref Pin */
.ref-pin {
  cursor: default;
}

.ref-pin .pin-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
}

/* Active Pin */
.active-pin {
  z-index: 10;
  cursor: grab;
}

.active-pin:active {
  cursor: grabbing;
}

.active-marker {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #38bdf8;
  color: #07090e;
  padding: 4px 8px;
  border-radius: 9999px;
  font-weight: 800;
  font-size: 12px;
  box-shadow: 0 0 15px #38bdf8;
  border: 2px solid #fff;
}

.pin-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 9999px;
  background: rgba(56, 189, 248, 0.4);
  animation: pulse 1.8s infinite;
  z-index: -1;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.pin-tooltip {
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  white-space: nowrap;
  font-size: 10px;
  color: #f1f5f9;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

/* Coordinates bar below */
.coordinates-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 14px;
}

.coord-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coord-input-group label {
  font-size: 12px;
  color: #94a3b8;
}

.coord-input-group input {
  width: 60px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  color: #38bdf8;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.coord-preview-pill {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  gap: 6px;
}

.coord-preview-pill strong {
  color: #38bdf8;
}
</style>

