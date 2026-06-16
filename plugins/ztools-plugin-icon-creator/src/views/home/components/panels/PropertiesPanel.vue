<template>
  <div class="right-panel-scroll">
    <!-- 对象属性 -->
    <template v-if="activeObject">
      <div class="section-title">
        <span v-if="isMultiSelection">已选中 {{ selectionCount }} 个对象</span>
        <span v-else>对象属性</span>
      </div>
      <template v-if="activeKaleidoscopeInstance">
        <div class="prop-section">
          <div class="prop-actions instance-actions">
            <button class="tb-btn" @click="selectKaleidoscopeSourceFromInstance">选中源对象</button>
            <button class="tb-btn" @click="detachKaleidoscopeInstance">脱离万花筒</button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="prop-section">
          <div class="prop-group transform-row">
            <label>位置</label>
            <span class="size-lock-spacer"></span>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.leftInput"
              @update:model-value="objProps.leftInput = String($event)"
              @change="setObjPropFromInput('left', $event)"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.topInput"
              @update:model-value="objProps.topInput = String($event)"
              @change="setObjPropFromInput('top', $event)"
            />
          </div>
          <div class="prop-group transform-row">
            <label>尺寸</label>
            <Icon
              class="size-lock-icon"
              :class="{ active: sizeRatioLocked }"
              :icon="sizeRatioLocked ? 'mdi:lock' : 'mdi:lock-open-variant'"
              :title="sizeRatioLocked ? '解锁宽高比例' : '锁定宽高比例'"
              @click="toggleSizeRatioLock"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.widthInput"
              @update:model-value="objProps.widthInput = String($event)"
              @change="setObjSizeFromInput('width', $event)"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.heightInput"
              @update:model-value="objProps.heightInput = String($event)"
              @change="setObjSizeFromInput('height', $event)"
            />
          </div>
          <div class="prop-group rotation-row">
            <label>旋转</label>
            <ZSlider
              :model-value="objProps.angle"
              :min="0"
              :max="360"
              :step="1"
              :formatter="(value) => `${Math.round(value)}°`"
              @change="setObjProp('angle', $event)"
            />
            <span class="val-label">{{ Math.round(objProps.angle) }}°</span>
          </div>
          <div class="prop-group transform-actions-row">
            <label>变换</label>
            <div class="transform-actions">
              <button class="tb-btn sm" title="水平翻转" @click="flipObject('x')">水平翻</button>
              <button class="tb-btn sm" title="垂直翻转" @click="flipObject('y')">垂直翻</button>
              <button class="tb-btn sm" title="重置变换" @click="resetTransform">重置</button>
            </div>
          </div>
          <div class="prop-group bezier-group-row">
            <label>倾斜</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.skewXInput"
              @update:model-value="objProps.skewXInput = String($event)"
              @change="setSkewFromInput('x', $event)"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.skewYInput"
              @update:model-value="objProps.skewYInput = String($event)"
              @change="setSkewFromInput('y', $event)"
            />
          </div>
          <div v-if="!(activeObject instanceof ActiveSelection)" class="prop-group style-color-row">
            <label>吸附边距</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.endpointSnapMarginInput"
              @update:model-value="objProps.endpointSnapMarginInput = String($event)"
              @change="setEndpointSnapMarginFromInput"
            />
          </div>
          <div class="prop-group align-row">
            <label>对齐</label>
            <ZPopover
              :show="alignPopoverVisible"
              trigger="hover"
              placement="bottom"
              :to="false"
              show-arrow
              keep-alive-on-hover
              @update:show="alignPopoverVisible = $event"
            >
              <template #trigger>
                <button
                  class="align-btn align-trigger"
                  :title="currentAlignPosition.label"
                  @click="alignToCanvas(currentAlignPosition.id)"
                >
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <rect :x="currentAlignPosition.svgX" :y="currentAlignPosition.svgY" width="6" height="4" rx="0.5" fill="currentColor" />
                  </svg>
                </button>
              </template>
              <div class="align-grid align-popover-grid">
                <button
                  v-for="pos in alignPositions"
                  :key="pos.id"
                  class="align-btn"
                  :class="{ active: pos.id === currentAlignId }"
                  :title="pos.label"
                  @click="selectAlign(pos.id)"
                >
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <rect x="1" y="1" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <rect :x="pos.svgX" :y="pos.svgY" width="6" height="4" rx="0.5" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </ZPopover>
          </div>
          <div v-if="canAlignSelection" class="prop-group selection-layout-row">
            <label>多选对齐</label>
            <div class="selection-layout-actions">
              <button class="tb-btn sm layout-tool-btn" title="以当前选区左边界为参考左对齐" @click="alignSelection('left')">左</button>
              <button class="tb-btn sm layout-tool-btn" title="以当前选区水平中心为参考居中" @click="alignSelection('center')">横中</button>
              <button class="tb-btn sm layout-tool-btn" title="以当前选区右边界为参考右对齐" @click="alignSelection('right')">右</button>
              <button class="tb-btn sm layout-tool-btn" title="以当前选区上边界为参考顶对齐" @click="alignSelection('top')">顶</button>
              <button class="tb-btn sm layout-tool-btn" title="以当前选区垂直中心为参考居中" @click="alignSelection('middle')">竖中</button>
              <button class="tb-btn sm layout-tool-btn" title="以当前选区下边界为参考底对齐" @click="alignSelection('bottom')">底</button>
            </div>
          </div>
          <div v-if="canDistributeSelection" class="prop-group selection-layout-row">
            <label>等距分布</label>
            <div class="selection-layout-actions distribute-actions">
              <button class="tb-btn sm layout-tool-btn" title="在当前选区左右边界之间水平等距分布" @click="distributeSelection('horizontal')">水平</button>
              <button class="tb-btn sm layout-tool-btn" title="在当前选区上下边界之间垂直等距分布" @click="distributeSelection('vertical')">垂直</button>
            </div>
          </div>
        </div>
        <div class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>填充</label>
            <ZSwitch size="small" :model-value="objProps.fillEnabled" @change="toggleFill" />
          </div>
          <div v-if="objProps.fillEnabled" class="prop-group">
            <label>模式</label>
            <div class="stroke-line-type-picker fill-style-picker">
              <button
                class="stroke-line-swatch fill-style-solid"
                :class="{ active: currentFillStyleMode === 'solid' }"
                title="纯色"
                @click="setFillStyleMode('solid')"
              />
              <button
                class="stroke-line-swatch fill-style-radial"
                :class="{ active: currentFillStyleMode === 'radial' }"
                title="径向渐变"
                @click="setFillStyleMode('radial')"
              />
              <button
                class="stroke-line-swatch fill-style-linear"
                :class="{ active: currentFillStyleMode === 'linear' }"
                title="线性渐变"
                @click="setFillStyleMode('linear')"
              />
            </div>
          </div>
          <div v-if="objProps.fillEnabled && currentFillStyleMode === 'solid'" class="prop-group style-color-row">
            <label>填充色</label>
            <ZColorPicker
              size="small"
              show-alpha
              :model-value="objProps.fill || '#000000'"
              @change="setSolidFillColor(String($event))"
            />
          </div>
          <template v-if="objProps.fillEnabled && objProps.fillMode === 'gradient'">
            <VueDraggable
              v-model="objProps.fillGradientStops"
              class="gradient-stop-list"
              item-key="id"
              handle=".gradient-stop-handle"
              @end="reorderFillGradientStops"
            >
              <div
                v-for="(stop, stopIndex) in objProps.fillGradientStops"
                :key="stop.id"
                class="prop-group gradient-stop-row"
              >
                <button class="gradient-stop-handle" type="button" title="拖动排序">
                  <Icon icon="mdi:drag-vertical" />
                </button>
                <ZColorPicker
                  size="small"
                  :show-input="false"
                  show-alpha
                  :model-value="stop.color"
                  @change="setFillGradientStopColor(stopIndex, String($event))"
                />
                <ZSlider
                  :model-value="Math.round(stop.offset * 100)"
                  :min="0"
                  :max="100"
                  :step="1"
                  :formatter="(value) => `${Math.round(value)}%`"
                  :disabled-value="(value) => isFillGradientStopPercentDisabled(stopIndex, value)"
                  @change="setFillGradientStopOffset(stopIndex, $event)"
                />
                <ZInput
                  size="small"
                  type="text"
                  class="gradient-stop-offset-input"
                  :model-value="`${Math.round(stop.offset * 100)}`"
                  @change="setFillGradientStopOffsetFromInput(stopIndex, $event)"
                  title="色标位置 (%)"
                />
                <button class="layer-icon-btn danger" :disabled="objProps.fillGradientStops.length <= 2" title="删除色标" @click="removeFillGradientStop(stopIndex)">
                  <Icon icon="mdi:close" />
                </button>
              </div>
            </VueDraggable>
            <div class="gradient-stop-actions">
              <button class="tb-btn sm gradient-stop-add-btn" @click="addFillGradientStop">添加渐变</button>
            </div>
            <div v-if="objProps.fillGradientType === 'linear'" class="prop-group rotation-row">
              <label>角度</label>
              <ZSlider
                :model-value="objProps.fillGradientAngle"
                :min="0"
                :max="359"
                :step="1"
                :formatter="(value) => `${Math.round(value)}°`"
                @change="setFillGradientAngleValue($event)"
              />
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.fillGradientAngleInput"
                @update:model-value="objProps.fillGradientAngleInput = String($event)"
                @change="setFillGradientAngleFromInput"
                title="渐变角度 (°)"
              />
            </div>
            <template v-if="objProps.fillGradientType === 'radial'">
              <div class="prop-group gradient-radius-row">
                <label>扩散范围</label>
                <ZSlider
                  :model-value="objProps.fillGradientRadius"
                  :min="0.05"
                  :max="2"
                  :step="0.01"
                  :formatter="(value) => `${Number(value).toFixed(2)}`"
                  @change="setFillGradientRadiusValue($event)"
                />
                <span class="val-label">{{ objProps.fillGradientRadius.toFixed(2) }}</span>
              </div>
            </template>
          </template>
        </div>
        <div class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>描边</label>
            <ZSwitch size="small" :model-value="objProps.strokeEnabled" @change="toggleStroke" />
          </div>
          <div v-if="objProps.strokeEnabled" class="prop-group style-color-row">
            <label>描边色</label>
            <ZColorPicker
              size="small"
              show-alpha
              :model-value="objProps.stroke || '#000000'"
              @change="setObjProp('stroke', String($event))"
            />
          </div>
          <div v-if="objProps.strokeEnabled" class="prop-group style-color-row">
            <label>描边宽</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.strokeWidthInput"
              @update:model-value="objProps.strokeWidthInput = String($event)"
              @change="setStrokeWidthFromInput"
            />
          </div>
          <div v-if="objProps.strokeEnabled" class="prop-group">
            <label>线型</label>
            <div class="stroke-line-type-picker">
              <button
                class="stroke-line-swatch solid"
                :class="{ active: objProps.strokeLineType === 'solid' }"
                title="实线"
                @click="setStrokeLineType('solid')"
              />
              <button
                class="stroke-line-swatch dashed"
                :class="{ active: objProps.strokeLineType === 'dashed' }"
                title="虚线"
                @click="setStrokeLineType('dashed')"
              />
            </div>
          </div>
          <div v-if="objProps.strokeEnabled && objProps.strokeLineType === 'dashed'" class="prop-group style-color-row">
            <label>虚线线长</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.strokeDashLengthInput"
              @update:model-value="objProps.strokeDashLengthInput = String($event)"
              @change="setStrokeDashLengthFromInput"
            />
          </div>
          <div v-if="objProps.strokeEnabled && objProps.strokeLineType === 'dashed'" class="prop-group style-color-row">
            <label>虚线间隔</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.strokeDashGapInput"
              @update:model-value="objProps.strokeDashGapInput = String($event)"
              @change="setStrokeDashGapFromInput"
            />
          </div>
        </div>
        <div class="prop-section">
          <div class="prop-group opacity-row">
            <label>透明度</label>
            <ZSlider
              :model-value="objProps.opacity"
              :min="0"
              :max="1"
              :step="0.01"
              :formatter="(value) => `${Math.round(value * 100)}%`"
              @change="setObjProp('opacity', $event)"
            />
            <span class="val-label">{{ Math.round(objProps.opacity * 100) }}%</span>
          </div>
        </div>
        <div class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>阴影效果</label>
            <button class="tb-btn sm" @click="addShadowEffect">添加</button>
          </div>
          <div v-if="objProps.shadowEffects && objProps.shadowEffects.length > 0" class="shadow-effects-list">
            <div
              v-for="(shadow, index) in objProps.shadowEffects"
              :key="shadow.id"
              class="shadow-effect-item"
            >
              <div class="prop-group style-toggle-row shadow-header">
                <label>{{ shadow.type === 'drop' ? '投影' : '内阴影' }} #{{ index + 1 }}</label>
                <ZSwitch size="small" :model-value="shadow.enabled" @change="toggleShadowEffect(index, $event)" />
              </div>
              <template v-if="shadow.enabled">
                <div class="prop-group style-color-row">
                  <label>颜色</label>
                  <ZColorPicker
                    size="small"
                    show-alpha
                    :model-value="shadow.color"
                    @change="setShadowEffectProp(index, 'color', String($event))"
                  />
                </div>
                <div class="prop-group bezier-group-row">
                  <label>偏移</label>
                  <ZInput
                    size="small"
                    type="text"
                    :model-value="shadow.offsetX"
                    @change="setShadowEffectProp(index, 'offsetX', $event)"
                  />
                  <ZInput
                    size="small"
                    type="text"
                    :model-value="shadow.offsetY"
                    @change="setShadowEffectProp(index, 'offsetY', $event)"
                  />
                </div>
                <div class="prop-group style-color-row">
                  <label>模糊</label>
                  <ZInput
                    size="small"
                    type="text"
                    :model-value="shadow.blur"
                    @change="setShadowEffectProp(index, 'blur', $event)"
                  />
                </div>
                <div class="prop-group" style="justify-content: flex-end; padding-top: 0;">
                  <button class="tb-btn sm danger" @click="removeShadowEffect(index)">删除</button>
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>模糊</label>
            <ZSwitch size="small" :model-value="objProps.blurEnabled" @change="toggleBlur" />
          </div>
          <div v-if="objProps.blurEnabled" class="prop-group style-color-row">
            <label>半径</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.blurRadiusInput"
              @update:model-value="objProps.blurRadiusInput = String($event)"
              @change="setBlurRadiusFromInput"
            />
          </div>
        </div>
        <div v-if="hasEditablePoints" class="prop-section">
          <div v-if="!hasSelectedPoint" class="prop-group style-color-row">
            <label>圆角</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.cornerRadiusInput"
              @update:model-value="objProps.cornerRadiusInput = String($event)"
              @change="setCornerRadiusFromInput"
            />
          </div>
          <div v-else-if="!hasSelectedArrowEndpoint" class="prop-group style-color-row">
            <label>点圆角</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.pointCornerRadiusInput"
              @update:model-value="objProps.pointCornerRadiusInput = String($event)"
              @change="setSelectedPointCornerRadiusFromInput"
            />
          </div>
        </div>
        <div v-if="hasSelectedArrowEndpoint" class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>箭头</label>
            <ZSwitch
              size="small"
              :model-value="arrowAggregated.enabled === true"
              @change="toggleSelectedArrowEnabled"
            />
          </div>
          <template v-if="arrowAggregated.enabled === true">
            <div v-if="!isHollowShaftArrow" class="prop-group">
              <label>形状</label>
              <div class="stroke-line-type-picker arrow-shape-picker">
                <button
                  class="stroke-line-swatch arrow-shape-solid"
                  :class="{ active: arrowAggregated.shape === 'solid' }"
                  title="实心"
                  @click="setSelectedArrowShape('solid')"
                />
                <button
                  class="stroke-line-swatch arrow-shape-hollow"
                  :class="{ active: arrowAggregated.shape === 'hollow' }"
                  title="空心"
                  @click="setSelectedArrowShape('hollow')"
                />
              </div>
            </div>
            <div v-if="!isHollowShaftArrow" class="prop-group rotation-row">
              <label>夹角</label>
              <ZSlider
                :model-value="arrowAggregated.angle ?? 60"
                :min="15"
                :max="150"
                :step="1"
                :formatter="(value) => `${Math.round(value)}°`"
                @change="setSelectedArrowAngle($event)"
              />
              <span class="val-label">{{ arrowAggregated.angle == null ? '—' : `${Math.round(arrowAggregated.angle)}°` }}</span>
            </div>
            <div v-if="isHollowShaftArrow" class="prop-group style-color-row">
              <label>线宽</label>
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.arrowLineWidthInput"
                @update:model-value="objProps.arrowLineWidthInput = String($event)"
                @change="setHollowArrowLineWidthFromInput"
              />
            </div>
            <div v-if="isHollowShaftArrow" class="prop-group rotation-row">
              <label>顶角</label>
              <ZSlider
                :model-value="objProps.arrowTipAngle"
                :min="15"
                :max="165"
                :step="1"
                :formatter="(value) => `${Math.round(value)}°`"
                @change="setHollowArrowTipAngle"
              />
              <span class="val-label">{{ `${Math.round(objProps.arrowTipAngle)}°` }}</span>
            </div>
            <div v-if="isHollowShaftArrow" class="prop-group rotation-row">
              <label>边角</label>
              <ZSlider
                :model-value="objProps.arrowSideAngle"
                :min="15"
                :max="90"
                :step="1"
                :formatter="(value) => `${Math.round(value)}°`"
                @change="setHollowArrowSideAngle"
              />
              <span class="val-label">{{ `${Math.round(objProps.arrowSideAngle)}°` }}</span>
            </div>
            <div class="prop-group style-color-row">
              <label>{{ isHollowShaftArrow ? '高度' : '长度' }}</label>
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.arrowLengthInput"
                @update:model-value="objProps.arrowLengthInput = String($event)"
                @change="setSelectedArrowLengthFromInput"
              />
            </div>
          </template>
        </div>
        <div v-if="hasSelectedCurveSegment" class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>曲线</label>
            <ZSwitch size="small" :model-value="objProps.curveEnabled" @change="setSelectedSegmentCurveEnabled" />
          </div>
          <div v-if="objProps.curveEnabled" class="prop-group bezier-group-row">
            <label>CP1</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.curveCp1XInput"
              @update:model-value="objProps.curveCp1XInput = String($event)"
              @change="setSelectedSegmentControlPointCoordFromInput('cp1', 'x', $event)"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.curveCp1YInput"
              @update:model-value="objProps.curveCp1YInput = String($event)"
              @change="setSelectedSegmentControlPointCoordFromInput('cp1', 'y', $event)"
            />
          </div>
          <div v-if="objProps.curveEnabled" class="prop-group bezier-group-row">
            <label>CP2</label>
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.curveCp2XInput"
              @update:model-value="objProps.curveCp2XInput = String($event)"
              @change="setSelectedSegmentControlPointCoordFromInput('cp2', 'x', $event)"
            />
            <ZInput
              size="small"
              type="text"
              :model-value="objProps.curveCp2YInput"
              @update:model-value="objProps.curveCp2YInput = String($event)"
              @change="setSelectedSegmentControlPointCoordFromInput('cp2', 'y', $event)"
            />
          </div>
        </div>
        <div class="prop-section">
          <div class="prop-group style-toggle-row">
            <label>万花筒</label>
            <ZSwitch
              size="small"
              :model-value="objProps.kaleidoscopeEnabled"
              :disabled="!activeKaleidoscopeEditableSource"
              @change="setKaleidoscopeEnabled"
            />
          </div>
          <template v-if="activeKaleidoscopeEditableSource && objProps.kaleidoscopeEnabled">
            <div class="prop-group bezier-group-row">
              <label>中心点</label>
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.kaleidoscopeCenterXInput"
                @update:model-value="objProps.kaleidoscopeCenterXInput = String($event)"
                @change="setKaleidoscopeCenterFromInput('x', $event)"
              />
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.kaleidoscopeCenterYInput"
                @update:model-value="objProps.kaleidoscopeCenterYInput = String($event)"
                @change="setKaleidoscopeCenterFromInput('y', $event)"
              />
            </div>
            <div class="prop-group style-toggle-row">
              <label>跟随旋转</label>
              <ZSwitch size="small" :model-value="objProps.kaleidoscopeFollowRotation" @change="setKaleidoscopeFollowRotation" />
            </div>
            <div class="prop-group style-color-row">
              <label>份数</label>
              <ZInput
                size="small"
                type="text"
                :model-value="objProps.kaleidoscopeCountInput"
                @update:model-value="objProps.kaleidoscopeCountInput = String($event)"
                @change="setKaleidoscopeCountFromInput"
              />
            </div>
          </template>
        </div>
        <div class="prop-actions boolean-actions">
          <button class="tb-btn" @mouseenter="showBooleanPreview('union')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('union')" :disabled="!canBoolean">并集</button>
          <button class="tb-btn" @mouseenter="showBooleanPreview('intersect')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('intersect')" :disabled="!canBoolean">交集</button>
          <ZPopover
            v-if="canBoolean"
            :show="subtractPopoverVisible"
            trigger="hover"
            placement="top"
            :to="false"
            show-arrow
            keep-alive-on-hover
            @update:show="handleSubtractPopoverShowChange"
          >
            <template #trigger>
              <button class="tb-btn" @mouseenter="showBooleanPreview('subtract')" @click="runBooleanOperation('subtract')">差集</button>
            </template>
            <div class="boolean-preview-menu">
              <template v-if="canDirectionalSubtract">
                <button class="tb-btn sm boolean-preview-option" @mouseenter="showBooleanPreview('subtract', 'forward')" @click="runBooleanOperation('subtract', 'forward')">A - B</button>
                <button class="tb-btn sm boolean-preview-option" @mouseenter="showBooleanPreview('subtract', 'reverse')" @click="runBooleanOperation('subtract', 'reverse')">B - A</button>
              </template>
              <div v-else class="boolean-preview-note">多对象差集预览当前默认结果</div>
            </div>
          </ZPopover>
          <button v-else class="tb-btn" disabled>差集</button>
          <button class="tb-btn" @mouseenter="showBooleanPreview('xor')" @mouseleave="clearBooleanPreview" @click="runBooleanOperation('xor')" :disabled="!canBoolean">异或</button>
          <span v-if="booleanBusy" class="boolean-status">处理中...</span>
          <span v-if="booleanError" class="boolean-error">{{ booleanError }}</span>
        </div>
        <div class="prop-actions">
          <button class="tb-btn" @click="copyStyle" title="复制样式 (Ctrl+Shift+C)">复制样式</button>
          <button class="tb-btn" @click="pasteStyle" title="粘贴样式 (Ctrl+Shift+V)">粘贴样式</button>
        </div>
        <div class="prop-actions">
          <button class="tb-btn" @click="groupObjects" :disabled="!canGroup" title="成组 (Ctrl+G)">成组</button>
          <button class="tb-btn" @click="ungroupObject" :disabled="!canUngroup" title="解组 (Ctrl+Shift+G)">解组</button>
          <ZPopover
            :show="lockPopoverVisible"
            trigger="click"
            placement="top"
            :to="false"
            show-arrow
            @update:show="lockPopoverVisible = $event"
          >
            <template #trigger>
              <button class="tb-btn">{{ getLockButtonLabel() }}</button>
            </template>
            <div class="lock-options-menu">
              <button class="tb-btn sm lock-option" @click="setLockMode('none')">
                <Icon v-if="currentLockMode === 'none'" icon="mdi:check" />
                <span>无锁定</span>
              </button>
              <button class="tb-btn sm lock-option" @click="setLockMode('position')">
                <Icon v-if="currentLockMode === 'position'" icon="mdi:check" />
                <span>锁定位置</span>
              </button>
              <button class="tb-btn sm lock-option" @click="setLockMode('size')">
                <Icon v-if="currentLockMode === 'size'" icon="mdi:check" />
                <span>锁定尺寸</span>
              </button>
              <button class="tb-btn sm lock-option" @click="setLockMode('full')">
                <Icon v-if="currentLockMode === 'full'" icon="mdi:check" />
                <span>完全锁定</span>
              </button>
            </div>
          </ZPopover>
          <button class="tb-btn danger" @click="deleteObject">删除</button>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="section-title">画布设置</div>
      <div class="prop-group">
        <label>预设</label>
        <ZSelect
          size="small"
          class="w-100%"
          :model-value="canvasPresetValue"
          :options="canvasPresetOptions"
          placeholder="请选择预设"
          @change="applyCanvasPreset(String($event))"
        />
      </div>
      <div class="prop-group">
        <label>宽高</label>
        <ZInput
          size="small"
          type="text"
          :model-value="canvasWidthInput"
          @update:model-value="canvasWidthInput = String($event)"
          @change="setCanvasSizeFromInput('width', $event)"
        />
        <ZInput
          size="small"
          type="text"
          :model-value="canvasHeightInput"
          @update:model-value="canvasHeightInput = String($event)"
          @change="setCanvasSizeFromInput('height', $event)"
        />
      </div>
      <div class="prop-group">
        <label>背景</label>
        <div class="canvas-bg-picker">
          <ZButton
            class="transparent-swatch"
            :class="{ active: isCanvasBgTransparent }"
            title="透明"
            @click="setCanvasBg('transparent')"
          />
          <ZColorPicker
            size="small"
            :show-input="false"
            :model-value="canvasBgPickerValue"
            @change="setCanvasBg(String($event))"
          />
        </div>
      </div>
      <div class="prop-group style-toggle-row">
        <label>网格</label>
        <ZSwitch size="small" :model-value="showPixelGrid" @change="setPixelGridVisible" />
      </div>
      <div class="prop-group style-toggle-row">
        <label>吸附</label>
        <ZSwitch size="small" :model-value="snapToPixelGrid" @change="setSnapToPixelGrid" />
      </div>
      <div class="prop-group style-color-row">
        <label>间距</label>
        <ZInput
          size="small"
          type="text"
          :model-value="pixelGridSizeInput"
          @update:model-value="pixelGridSizeInput = String($event)"
          @change="setPixelGridSizeFromInput"
        />
      </div>
      <div class="prop-group style-color-row">
        <label>参考线</label>
        <ZSelect
          size="small"
          class="w-100%"
          :model-value="keylineTemplate"
          :options="keylineTemplateOptions"
          @change="setKeylineTemplate(String($event) as KeylineTemplate)"
        />
      </div>
      <div v-if="keylineTemplate === 'custom'" class="prop-group style-color-row">
        <label>安全区</label>
        <ZInput
          size="small"
          type="text"
          :model-value="keylineMarginInput"
          @update:model-value="keylineMarginInput = String($event)"
          @change="setKeylineMarginFromInput"
        />
      </div>
      <div v-if="keylineTemplate !== 'none'" class="prop-group rotation-row">
        <label>透明度</label>
        <ZSlider
          :model-value="keylineOpacity"
          :min="0"
          :max="1"
          :step="0.01"
          :formatter="(value) => `${Math.round(Number(value) * 100)}%`"
          @change="setKeylineOpacity"
        />
        <span class="val-label">{{ `${Math.round(keylineOpacity * 100)}%` }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Icon } from '@iconify/vue'
import { ActiveSelection, type FabricObject } from 'fabric'
import { ZButton, ZColorPicker, ZInput, ZPopover, ZSelect, ZSlider, ZSwitch } from 'ztools-ui'
import type { ColorPaletteGroup, GradientPresetItem, KeylineTemplate, StylePresetManagerTab, StyleTargetChannel } from '../../types'

type AnyFn = (...args: any[]) => any

type SelectOption = {
  label: string
  value: string
}

const props = defineProps<{
  activeObject: FabricObject | null
  isMultiSelection: boolean
  selectionCount: number
  activeKaleidoscopeInstance: FabricObject | null | undefined
  activeKaleidoscopeEditableSource: FabricObject | null | undefined
  objProps: Record<string, any>
  sizeRatioLocked: boolean
  alignPopoverVisible: boolean
  currentAlignPosition: Record<string, any>
  alignPositions: Array<Record<string, any>>
  currentAlignId: string
  currentFillStyleMode: string
  hasEditablePoints: boolean
  hasSelectedPoint: boolean
  hasSelectedArrowEndpoint: boolean
  arrowAggregated: Record<string, any>
  isHollowShaftArrow: boolean
  hasSelectedCurveSegment: boolean
  canBoolean: boolean
  canDirectionalSubtract: boolean
  subtractPopoverVisible: boolean
  booleanBusy: boolean
  booleanError: string
  canGroup: boolean
  canUngroup: boolean
  canAlignSelection: boolean
  canDistributeSelection: boolean
  canvasPresetValue: string
  canvasPresetOptions: SelectOption[]
  canvasWidthInput: string
  canvasHeightInput: string
  canvasBgPickerValue: string
  isCanvasBgTransparent: boolean
  showPixelGrid: boolean
  snapToPixelGrid: boolean
  pixelGridSizeInput: string
  keylineTemplate: KeylineTemplate
  keylineTemplateOptions: SelectOption[]
  keylineMarginInput: string
  keylineOpacity: number
  colorPaletteGroups: ColorPaletteGroup[]
  gradientPresets: GradientPresetItem[]
  colorPaletteColumns: number
  selectKaleidoscopeSourceFromInstance: AnyFn
  detachKaleidoscopeInstance: AnyFn
  setObjPropFromInput: AnyFn
  setObjSizeFromInput: AnyFn
  toggleSizeRatioLock: AnyFn
  setObjProp: AnyFn
  setEndpointSnapMarginFromInput: AnyFn
  alignToCanvas: AnyFn
  selectAlign: AnyFn
  toggleFill: AnyFn
  setFillStyleMode: AnyFn
  setSolidFillColor: AnyFn
  reorderFillGradientStops: AnyFn
  setFillGradientStopColor: AnyFn
  isFillGradientStopPercentDisabled: AnyFn
  setFillGradientStopOffset: AnyFn
  setFillGradientStopOffsetFromInput: AnyFn
  removeFillGradientStop: AnyFn
  addFillGradientStop: AnyFn
  setFillGradientAngleValue: AnyFn
  setFillGradientAngleFromInput: AnyFn
  setFillGradientRadiusValue: AnyFn
  applyColorSwatch: AnyFn
  applyGradientPreset: AnyFn
  toggleStroke: AnyFn
  setStrokeWidthFromInput: AnyFn
  setStrokeLineType: AnyFn
  setStrokeDashLengthFromInput: AnyFn
  setStrokeDashGapFromInput: AnyFn
  setCornerRadiusFromInput: AnyFn
  setSelectedPointCornerRadiusFromInput: AnyFn
  toggleSelectedArrowEnabled: AnyFn
  setSelectedArrowShape: AnyFn
  setSelectedArrowAngle: AnyFn
  setHollowArrowLineWidthFromInput: AnyFn
  setHollowArrowTipAngle: AnyFn
  setHollowArrowSideAngle: AnyFn
  setSelectedArrowLengthFromInput: AnyFn
  setSelectedSegmentCurveEnabled: AnyFn
  setSelectedSegmentControlPointCoordFromInput: AnyFn
  setKaleidoscopeEnabled: AnyFn
  setKaleidoscopeCenterFromInput: AnyFn
  setKaleidoscopeFollowRotation: AnyFn
  setKaleidoscopeCountFromInput: AnyFn
  showBooleanPreview: AnyFn
  clearBooleanPreview: AnyFn
  runBooleanOperation: AnyFn
  handleSubtractPopoverShowChange: AnyFn
  groupObjects: AnyFn
  ungroupObject: AnyFn
  alignSelection: AnyFn
  distributeSelection: AnyFn
  lockObject: AnyFn
  deleteObject: AnyFn
  applyCanvasPreset: AnyFn
  setCanvasSizeFromInput: AnyFn
  setCanvasBg: AnyFn
  setPixelGridVisible: AnyFn
  setSnapToPixelGrid: AnyFn
  setPixelGridSizeFromInput: AnyFn
  setKeylineTemplate: AnyFn
  setKeylineMarginFromInput: AnyFn
  setKeylineOpacity: AnyFn
  openStylePresetManager: (tab: StylePresetManagerTab) => void
  addShadowEffect: AnyFn
  toggleShadowEffect: AnyFn
  setShadowEffectProp: AnyFn
  removeShadowEffect: AnyFn
  toggleBlur: AnyFn
  setBlurRadiusFromInput: AnyFn
  flipObject: AnyFn
  resetTransform: AnyFn
  setSkewFromInput: AnyFn
  copyStyle: AnyFn
  pasteStyle: AnyFn
  currentLockMode: string
  setLockMode: AnyFn
}>()

const lockPopoverVisible = ref(false)

function getLockButtonLabel() {
  switch (props.currentLockMode) {
    case 'position':
      return '锁位置'
    case 'size':
      return '锁尺寸'
    case 'full':
      return '已锁定'
    default:
      return '锁定'
  }
}

const emit = defineEmits<{
  (event: 'update:align-popover-visible', value: boolean): void
  (event: 'update:canvas-width-input', value: string): void
  (event: 'update:canvas-height-input', value: string): void
  (event: 'update:pixel-grid-size-input', value: string): void
  (event: 'update:keyline-margin-input', value: string): void
}>()

const colorSwatchTargets: Array<{ channel: StyleTargetChannel; label: string; className: string }> = [
  { channel: 'fill', label: '填', className: 'fill-target' },
  { channel: 'stroke', label: '描', className: 'stroke-target' }
]

// 生成色板按钮提示，区分同一颜色应用到填充或描边，减少小按钮含义不清的问题。
function getColorSwatchButtonTitle(name: string, channel: StyleTargetChannel) {
  return `${channel === 'fill' ? '应用到填充' : '应用到描边'}：${name}`
}

// 把预设色标格式化为 CSS 渐变 stop，供属性面板中轻量预览渐变外观。
function getGradientStopCss(preset: GradientPresetItem) {
  const stops = [...preset.stops].sort((a, b) => a.offset - b.offset)
  return stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ')
}

// 将 Fabric 的 0° 向右角度转换为 CSS linear-gradient 的角度体系，用于保持预览方向接近实际填充。
function getCssLinearGradientAngle(angle: unknown) {
  const parsed = Number(angle)
  const normalized = Number.isFinite(parsed) ? parsed : 0
  return (normalized + 90) % 360
}

// 根据线性 / 径向预设生成预览块背景；只影响面板展示，不参与 Fabric 对象数据。
function getGradientPresetStyle(preset: GradientPresetItem) {
  const stops = getGradientStopCss(preset)
  if (preset.type === 'radial') {
    const x = Math.round((Number(preset.centerX) || 0.5) * 100)
    const y = Math.round((Number(preset.centerY) || 0.5) * 100)
    return { background: `radial-gradient(circle at ${x}% ${y}%, ${stops})` }
  }
  return { background: `linear-gradient(${getCssLinearGradientAngle(preset.angle)}deg, ${stops})` }
}

// 生成渐变预设 tooltip，补充类型和自定义来源，便于区分内置预设与用户保存预设。
function getGradientPresetTitle(preset: GradientPresetItem) {
  const typeLabel = preset.type === 'radial' ? '径向渐变' : '线性渐变'
  return `${preset.name} · ${typeLabel}${preset.userCreated ? ' · 我的预设' : ''}`
}

const colorPaletteColumns = computed(() => {
  const parsed = Number(props.colorPaletteColumns)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6
})
const alignPopoverVisible = computed({
  get: () => props.alignPopoverVisible,
  set: (value: boolean) => emit('update:align-popover-visible', value)
})
const canvasWidthInput = computed({
  get: () => props.canvasWidthInput,
  set: (value: string) => emit('update:canvas-width-input', value)
})
const canvasHeightInput = computed({
  get: () => props.canvasHeightInput,
  set: (value: string) => emit('update:canvas-height-input', value)
})
const pixelGridSizeInput = computed({
  get: () => props.pixelGridSizeInput,
  set: (value: string) => emit('update:pixel-grid-size-input', value)
})
const keylineMarginInput = computed({
  get: () => props.keylineMarginInput,
  set: (value: string) => emit('update:keyline-margin-input', value)
})
</script>

<style lang="scss" scoped>
@use '../../styles/tokens' as *;

.right-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.section-title {
  font-weight: 700;
  font-size: 12px;
  padding: 6px 4px;
  color: #555;
}
.tb-btn {
  padding: 4px 10px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  &:hover { background: #e8e8e8; }
  &:disabled { opacity: 0.4; cursor: default; }
  &.sm { padding: 3px 7px; font-size: 11px; }
  &.danger { color: #c00; }
}
.canvas-bg-picker,
.stroke-line-type-picker {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  :deep(.zt-color-picker) {
    display: inline-flex;
    flex: 0 0 auto;
  }
}
.transparent-swatch {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  overflow: hidden;
  padding: 0;
  box-sizing: border-box;
  background-color: #fafafa;
  background-image:
    linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07)),
    linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07));
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  box-shadow: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background-color: #fafafa;
    background-image:
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07)),
      linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.07));
    background-position: 0 0, 6px 6px;
    background-size: 12px 12px;
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
  }
}
.stroke-line-swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;

  &::before {
    content: '';
    display: block;
    width: 16px;
    height: 0;
    border-top: 2px solid #333;
    margin: 0 auto;
  }

  &.dashed::before {
    border-top-style: dashed;
  }

  &:hover:not(:disabled) {
    background-color: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
  }

  &.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
  }
}
.arrow-shape-picker,
.fill-style-picker {
  .stroke-line-swatch {
    &::before {
      display: none;
    }
    background-color: #fafafa;
    background-position: center;
    background-repeat: no-repeat;
    background-size: 18px 16px;

    &:hover:not(:disabled) {
      background-color: #fafafa;
    }
  }
}
.arrow-shape-picker {
  .arrow-shape-solid {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><path d='M2 8H11' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round'/><path d='M10.2 4.15C10.2 3.57 10.85 3.23 11.33 3.55L15.32 6.22C16.5 7.01 16.5 8.99 15.32 9.78L11.33 12.45C10.85 12.77 10.2 12.43 10.2 11.85V4.15Z' fill='%23333'/></svg>");
  }
  .arrow-shape-hollow {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><path d='M2 8H11' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round'/><path d='M10.4 4.5L13.9 8L10.4 11.5' fill='none' stroke='%23333' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  }
}
.fill-style-picker {
  .fill-style-solid {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><rect x='3' y='3' width='12' height='10' rx='2' fill='%23333'/></svg>");
  }
  .fill-style-radial {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='65%25'><stop offset='0%25' stop-color='%23333'/><stop offset='100%25' stop-color='%23d8d8d8'/></radialGradient></defs><rect x='3' y='3' width='12' height='10' rx='2' fill='url(%23g)' stroke='%23333' stroke-width='0.6'/></svg>");
  }
  .fill-style-linear {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 16'><defs><linearGradient id='g' x1='0%25' y1='50%25' x2='100%25' y2='50%25'><stop offset='0%25' stop-color='%23333'/><stop offset='100%25' stop-color='%23d8d8d8'/></linearGradient></defs><rect x='3' y='3' width='12' height='10' rx='2' fill='url(%23g)' stroke='%23333' stroke-width='0.6'/></svg>");
  }
}
.size-lock-icon,
.size-lock-spacer {
  width: 20px;
  height: 22px;
  flex-shrink: 0;
}
.size-lock-spacer {
  display: block;
}
.size-lock-icon {
  justify-self: center;
  padding: 3px;
  cursor: pointer;
  color: #666;
  &.active { color: #1e6fff; }
}
.prop-section {
  padding: 4px 0;
  border-bottom: $border;
}
.transform-row {
  display: grid!important;
  grid-template-columns: 28px 20px 1fr 1fr;
  column-gap: 4px;
}
.align-row {
  display: grid!important;
  grid-template-columns: 36px 1fr;
  column-gap: 8px;
  align-items: center;
  :deep(.zt-popover) {
    justify-self: end;
  }
}
.selection-layout-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  min-width: 0;
}
.distribute-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.layout-tool-btn {
  min-width: 0;
  padding-inline: 4px;
}
.align-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 4px;
  width: 100%;
}
.align-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 3px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 5px;
  background: #fff;
  color: #555;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  &:hover {
    background: color-mix(in srgb, var(--primary-color) 8%, #fff);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  &.active {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, #fff);
  }
  &.align-trigger {
    color: var(--primary-color);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}
.align-grid .align-btn {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
}
.align-popover-grid {
  width: 108px;
}
:deep(.zt-popover__panel:has(.align-popover-grid) .zt-popover__content) {
  min-width: 0;
}
:deep(.zt-popover__panel:has(.align-popover-grid) .zt-popover__body--card) {
  padding: 8px;
}
.gradient-stop-list {
  display: flex;
  flex-direction: column;
}
.prop-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  label {
    font-size: 11px;
    color: #666;
    min-width: 36px;
  }
  :deep(.zt-input) {
    width: 100%;
  }
  .val-label {
    font-size: 11px;
    color: #666;
    min-width: 36px;
    text-align: right;
  }
  &.rotation-row,
  &.opacity-row,
  &.gradient-radius-row {
    label {
      width: 52px;
      min-width: 52px;
      white-space: nowrap;
    }
  }
  &.style-toggle-row,
  &.style-color-row {
    display: grid;
    grid-template-columns: 48px 1fr;
    column-gap: 8px;
  }
  &.gradient-stop-row {
    display: grid;
    grid-template-columns: 20px auto minmax(0, 1fr) 60px auto;
    column-gap: 6px;
    align-items: center;

    .gradient-stop-offset-input {
      width: 100%;
    }
  }
  &.bezier-group-row {
    display: grid;
    grid-template-columns: 48px 1fr 1fr;
    column-gap: 6px;
  }
  &.selection-layout-row {
    display: grid;
    grid-template-columns: 48px 1fr;
    column-gap: 8px;
  }
  .stroke-line-type-picker {
    justify-self: end;
  }
  &.style-toggle-row {
    :deep(.zt-switch) {
      justify-self: end;
    }
  }
}
.gradient-stop-actions {
  padding: 4px 8px 8px;
}
.gradient-stop-add-btn {
  width: 100%;
}
.gradient-stop-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #888;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}
.layer-icon-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &.danger:hover { color: #c00; }
}
.trace-mode-picker {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  .tb-btn.active {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 10%, #fff);
  }
}
.prop-actions {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  flex-wrap: wrap;
}
.boolean-actions {
  border-bottom: $border;
  margin-top: 0;
}
.boolean-preview-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}
.boolean-preview-option {
  width: 100%;
  justify-content: flex-start;
}
.boolean-preview-note {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  max-width: 180px;
}
.boolean-status,
.boolean-error {
  width: 100%;
  font-size: 12px;
}
.boolean-status { color: #666; }
.boolean-error { color: #c00; }

.shadow-effects-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px 8px;
}
.shadow-effect-item {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 6px;
  padding: 4px 8px;
  background: #fafafa;
}
.shadow-header {
  padding: 4px 0 !important;
}
.transform-actions-row {
  display: grid !important;
  grid-template-columns: 48px 1fr;
  column-gap: 8px;
}
.transform-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
.lock-options-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  min-width: 120px;
}
.lock-option {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  width: 100%;
  text-align: left;
}
.lock-option .iconify {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
