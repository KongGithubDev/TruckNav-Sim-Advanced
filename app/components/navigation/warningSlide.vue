<script lang="ts" setup>
const emit = defineEmits<{
    actionClick: [];
}>();

const props = defineProps<{
    showIf: boolean;
    resetOn?: boolean;
    text: string;
    actionButtonLabel?: string;
}>();

const isExpanded = ref(false);

watch(
    () => props.resetOn,
    (newValue) => {
        if (newValue) {
            isExpanded.value = false;
        }
    },
);

const onToggleExpanded = () => {
    isExpanded.value = !isExpanded.value;
};

const onActionClick = (e: MouseEvent) => {
    e.stopPropagation();
    emit('actionClick');
};
</script>

<template>
    <Transition name="compact-slide">
        <div
            v-if="showIf"
            class="compact-trip-progress"
            :class="{ expanded: isExpanded, 'has-action': !!actionButtonLabel }"
            v-on:click="onToggleExpanded"
        >
            <Icon v-if="isExpanded" name="lucide:chevron-right" size="22" />
            <Icon v-else name="lucide:chevron-left" size="22" />

            <div class="warning-message">
                <Icon name="lucide:triangle-alert" size="22" />

                <div class="text-content">
                    <span class="text-nowrap">{{ text }}</span>
                </div>
            </div>

            <button
                v-if="actionButtonLabel"
                class="warning-action-btn"
                @click="onActionClick"
            >
                {{ actionButtonLabel }}
            </button>
        </div>
    </Transition>
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/navigation/warningSlide.scss"
></style>
