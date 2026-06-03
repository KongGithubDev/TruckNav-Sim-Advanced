<script lang="ts" setup>
import { isBridgeRunning } from "~/assets/utils/telemetry/helpers";
import { usePlatform } from "~/composables/Platform";
import SegmentedControl from "../segmentedControl.vue";

const { settings, updateGlobal } = useSettings();
const { settings: desktopSettings, updateDesktopSetting } = useDesktopSettings();
const { t } = useTranslations();
const { isElectron } = usePlatform();
const { fetchIp, fetchPort, localIP, localPort } = useNetwork();

const bridgeStatus = ref<"checking" | "connected" | "disconnected">("checking");
const etsPluginActive = ref(false);
const atsPluginActive = ref(false);

const startWithWindows = computed(() => desktopSettings.value.startWithWindows);
const startMinimized = computed(() => desktopSettings.value.startMinimized);

async function checkBridge() {
    bridgeStatus.value = "checking";
    try {
        const running = await isBridgeRunning("127.0.0.1");
        bridgeStatus.value = running ? "connected" : "disconnected";
    } catch {
        bridgeStatus.value = "disconnected";
    }
}

async function checkPlugins() {
    if (!isElectron.value || !(window as any).electronAPI) return;
    try {
        const statuses = await (window as any).electronAPI.checkPluginStatuses();
        etsPluginActive.value = statuses.ets2;
        atsPluginActive.value = statuses.ats;
    } catch (e) {
        console.error("Failed to check plugin statuses", e);
    }
}

async function handleExplorerLaunch(gameName: string) {
    if (!(window as any).electronAPI) return;
    try {
        const result = await (window as any).electronAPI.selectGameFolder(gameName);
        if (result.success) {
            await checkPlugins();
        }
    } catch (e) {
        console.error("Failed to launch explorer", e);
    }
}

onMounted(async () => {
    await fetchIp();
    await fetchPort();
    await checkBridge();
    await checkPlugins();
});
</script>

<template>
    <div>
        <!-- Connection Section -->
        <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <Icon name="lucide:satellite-dish" size="18" style="color: #a1a1aa;" />
                <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Connection
                </span>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:network" size="24" />
                <p>Bridge Status</p>
            </div>
            <span :style="{
                fontSize: '1.4rem',
                fontWeight: 600,
                color: bridgeStatus === 'connected' ? '#4caf50' : bridgeStatus === 'checking' ? '#a1a1aa' : '#f44336'
            }">
                <Icon v-if="bridgeStatus === 'connected'" name="lucide:circle-check-big" size="18" />
                <Icon v-else-if="bridgeStatus === 'checking'" name="lucide:loader-circle" size="18" />
                <Icon v-else name="lucide:circle-x" size="18" />
                {{ bridgeStatus === 'connected' ? t('common.connected') : bridgeStatus === 'checking' ? 'Checking...' : t('common.disconnected') }}
            </span>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:globe" size="24" />
                <p>Local IP</p>
            </div>
            <span style="font-size: 1.4rem; font-weight: 600; color: #22d3ee; font-family: monospace;">
                {{ localIP || "—" }}{{ localPort ? `:${localPort}` : "" }}
            </span>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:save" size="24" />
                <p>Saved Bridge IP</p>
            </div>
            <span style="font-size: 1.4rem; font-weight: 600; font-family: monospace;">
                {{ settings.savedIP || "—" }}
            </span>
        </div>

        <div class="option setting">
            <button
                @click="checkBridge"
                class="nav-btn settings-btn"
                style="background: var(--theme-color); color: #fff; font-weight: 600;"
            >
                <Icon name="lucide:refresh-cw" size="18" />
                Test Connection
            </button>
        </div>

        <!-- Electron-only sections -->
        <template v-if="isElectron">
            <div class="small-separator"></div>

            <!-- Plugin Status Section -->
            <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <Icon name="lucide:plug" size="18" style="color: #a1a1aa;" />
                    <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Plugin Status
                    </span>
                </div>
            </div>

            <div class="option setting">
                <div class="option-title">
                    <Icon name="lucide:truck" size="24" />
                    <p>ETS2 Plugin</p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span :style="{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        color: etsPluginActive ? '#4caf50' : '#f44336'
                    }">
                        {{ etsPluginActive ? t('common.active') : t('common.missing') }}
                    </span>
                    <button
                        @click="handleExplorerLaunch('ETS2')"
                        class="nav-btn settings-btn"
                        style="background: transparent; border: 1px solid rgba(255,255,255,0.15); padding: 6px 10px;"
                        title="Select ETS2 folder"
                    >
                        <Icon name="lucide:folder-cog" size="18" />
                    </button>
                </div>
            </div>

            <div class="option setting">
                <div class="option-title">
                    <Icon name="lucide:truck" size="24" />
                    <p>ATS Plugin</p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span :style="{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        color: atsPluginActive ? '#4caf50' : '#f44336'
                    }">
                        {{ atsPluginActive ? t('common.active') : t('common.missing') }}
                    </span>
                    <button
                        @click="handleExplorerLaunch('ATS')"
                        class="nav-btn settings-btn"
                        style="background: transparent; border: 1px solid rgba(255,255,255,0.15); padding: 6px 10px;"
                        title="Select ATS folder"
                    >
                        <Icon name="lucide:folder-cog" size="18" />
                    </button>
                </div>
            </div>

            <div class="small-separator"></div>

            <!-- Auto-Start Section -->
            <div class="option setting" style="padding-top: 4px; padding-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <Icon name="lucide:power" size="18" style="color: #a1a1aa;" />
                    <span style="font-size: 1.3rem; color: #a1a1aa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Auto-Start
                    </span>
                </div>
            </div>

            <div class="option setting">
                <div class="option-title">
                    <Icon name="lucide:monitor" size="24" />
                    <p>{{ t("desktop.launchStartup") }}</p>
                </div>

                <SegmentedControl
                    :left-option="t('common.on')"
                    :right-option="t('common.off')"
                    @connect="updateDesktopSetting('startWithWindows', !startWithWindows)"
                    size="small"
                    :active="startWithWindows"
                />
            </div>

            <div class="option setting">
                <div class="option-title">
                    <Icon name="lucide:minus" size="24" />
                    <p>{{ t("desktop.startMinimized") }}</p>
                </div>

                <SegmentedControl
                    :left-option="t('common.on')"
                    :right-option="t('common.off')"
                    @connect="updateDesktopSetting('startMinimized', !startMinimized)"
                    size="small"
                    :active="startMinimized"
                />
            </div>
        </template>
    </div>
</template>
