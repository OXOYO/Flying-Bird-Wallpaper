<script setup>
defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
  meta: { type: String, default: '' },
  desc: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  static: { type: Boolean, default: false }
})
</script>

<template>
  <div
    class="scope-card"
    :class="{
      'scope-card--selected': selected,
      'scope-card--disabled': disabled,
      'scope-card--static': static
    }"
  >
    <div class="scope-card__head">
      <span class="scope-card__title">{{ title }}</span>
      <span v-if="count > 0" class="scope-card__count">{{ count }}</span>
    </div>
    <p v-if="meta" class="scope-card__meta">{{ meta }}</p>
    <p v-if="desc" class="scope-card__desc">{{ desc }}</p>
  </div>
</template>
