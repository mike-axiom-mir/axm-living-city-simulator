from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Expected {label} anchor missing; refuse broad rewrite.")
    return text.replace(old, new, 1)


ui = Path("src/ui.js")
s = ui.read_text("utf-8")
s = replace_once(
    s,
    "    { id: 'economy', label: 'Local Economy' },\n    { id: 'stewardship', label: 'Stewardship' },",
    "    { id: 'economy', label: 'Local Economy' },\n    { id: 'engineering', label: 'Engineering' },\n    { id: 'stewardship', label: 'Stewardship' },",
    "section registry",
)
s = replace_once(
    s,
    "    syncStickyOffset() {\n      const topbar = this.app?.querySelector('.topbar');\n      const compact = root.matchMedia?.('(max-width: 720px)').matches;\n      this.app?.style.setProperty('--topbar-height', `${compact ? 0 : Math.ceil(topbar?.getBoundingClientRect().height || 0)}px`);\n    },",
    "    syncStickyOffset() {\n      const topbar = this.app?.querySelector('.topbar');\n      const switcher = this.app?.querySelector('.view-switcher');\n      const compact = root.matchMedia?.('(max-width: 720px)').matches;\n      const topbarHeight = compact ? 0 : Math.ceil(topbar?.getBoundingClientRect().height || 0);\n      const switcherHeight = Math.ceil(switcher?.getBoundingClientRect().height || 0);\n      this.app?.style.setProperty('--topbar-height', `${topbarHeight}px`);\n      this.app?.style.setProperty('--switcher-height', `${switcherHeight}px`);\n    },",
    "sticky offset measurement",
)
ui.write_text(s, encoding="utf-8")

styles = Path("styles.css")
s = styles.read_text("utf-8")
s = replace_once(
    s,
    "  scroll-margin-top: calc(var(--topbar-height, 92px) + 60px);",
    "  scroll-margin-top: calc(var(--topbar-height, 92px) + var(--switcher-height, 60px));",
    "desktop section scroll margin",
)
s = replace_once(
    s,
    "    scroll-margin-top: 60px;",
    "    scroll-margin-top: calc(var(--topbar-height, 0px) + var(--switcher-height, 60px));",
    "mobile section scroll margin",
)
styles.write_text(s, encoding="utf-8")

engineering = Path("src/engineering_ui.js")
s = engineering.read_text("utf-8")
start = s.find("  function decorateTabs(world) {")
end = s.find("\n  function drawEngineeringCanvas", start)
if start < 0 or end < 0:
    raise SystemExit("Expected Engineering tab decorator seam missing.")
new_block = """  function decorateTabs(world) {
    const nav = UI.app?.querySelector('.tabbar');
    if (!nav) return;
    let button = nav.querySelector('[data-action=\"tab\"][data-id=\"engineering\"]');
    if (!button) {
      // Compatibility fallback for older host UIs. Current Living City owns
      // Engineering in the canonical section registry.
      button = nav.querySelector('[data-action=\"engineering-tab\"]');
      if (!button) {
        button = document.createElement('button');
        button.className = 'tab-button';
        button.id = 'tab-engineering';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'active-view');
        button.dataset.action = 'engineering-tab';
        button.dataset.id = 'engineering';
        button.textContent = 'Engineering';
        const anchor = nav.querySelector('[data-action=\"tab\"][data-id=\"stewardship\"]');
        nav.insertBefore(button, anchor || null);
      }
    }
    nav.querySelectorAll('.tab-button').forEach((entry) => {
      const entryId = entry.dataset.id || (entry.dataset.action === 'engineering-tab' ? 'engineering' : null);
      const active = entryId === world.ui.activeTab;
      entry.classList.toggle('active', active);
      if (entry.getAttribute('role') === 'tab') {
        entry.setAttribute('aria-selected', String(active));
        entry.tabIndex = active ? 0 : -1;
      }
    });
  }
"""
s = s[:start] + new_block + s[end:]

old_wrapper_start = s.find("  const originalRender = UI.render;")
old_wrapper_end = s.find("\n  AXM.EngineeringUI = Object.freeze({", old_wrapper_start)
if old_wrapper_start < 0 or old_wrapper_end < 0:
    raise SystemExit("Expected Engineering render wrapper seam missing.")
new_wrapper = """  const originalRenderView = UI.renderView;
  UI.renderView = function renderViewWithEngineering(world, ...args) {
    if (world?.ui?.activeTab === 'engineering') return renderEngineering(world);
    return originalRenderView.call(this, world, ...args);
  };

  const originalRender = UI.render;
  UI.render = function renderWithEngineering(world, ...args) {
    cancelEngineeringLoop();
    originalRender.call(this, world, ...args);
    decorateTabs(world);
    if (world?.ui?.activeTab === 'engineering') startEngineeringLoop(world);
  };
"""
s = s[:old_wrapper_start] + new_wrapper + s[old_wrapper_end:]
engineering.write_text(s, encoding="utf-8")

navtest = Path("tests/navigation_continuity_test.js")
s = navtest.read_text("utf-8")
if "UI.navigationTarget('economy', 'ArrowRight'), 'engineering'" not in s:
    s = replace_once(
        s,
        "assert.equal(UI.navigationTarget('visuals', 'End'), 'lab');",
        "assert.equal(UI.navigationTarget('visuals', 'End'), 'lab');\nassert.equal(UI.navigationTarget('economy', 'ArrowRight'), 'engineering');\nassert.equal(UI.navigationTarget('engineering', 'ArrowLeft'), 'economy');\nassert.equal(UI.navigationTarget('engineering', 'ArrowRight'), 'stewardship');",
        "navigation routing test",
    )
s = s.replace('aria-label="Section 5 of 18"', 'aria-label="Section 5 of 19"')
if "Section 14 of 19" not in s:
    marker = 'assert.match(markup, /data-action="tab-relative" data-direction="1"/);'
    addition = marker + "\n\nworld.ui.activeTab = 'engineering';\nconst engineeringMarkup = UI.renderTabs(world);\nassert.match(engineeringMarkup, /id=\"tab-engineering\" role=\"tab\" aria-selected=\"true\" aria-controls=\"active-view\" tabindex=\"0\"/);\nassert.match(engineeringMarkup, /aria-label=\"Section 14 of 19\"/);"
    s = replace_once(s, marker, addition, "Engineering navigation markup test")
s = s.replace("PASS navigation continuity: 18-view semantics", "PASS navigation continuity: 19-view semantics")
navtest.write_text(s, encoding="utf-8")

browser = Path("tests/visual_presence_browser_test.py")
s = browser.read_text("utf-8")
s = s.replace(
    "        page.wait_for_timeout(300)\n\n        assert page.locator('.tab-button').count() == 18",
    "        page.wait_for_function(\"() => document.querySelectorAll('.tab-button').length === 19\", timeout=10000)\n\n        assert page.locator('.tab-button').count() == 19",
)
if "Section 14 of 19" not in s:
    needle = """        assert page.locator('#active-view').evaluate('''(view) => {
          const topbar = document.querySelector('.topbar').getBoundingClientRect();
          const switcher = document.querySelector('.view-switcher').getBoundingClientRect();
          return Math.abs(view.getBoundingClientRect().top - (topbar.height + switcher.height)) <= 2;
        }''')"""
    extra = needle + """

        engineering_tab = page.locator('[role="tab"][data-id="engineering"]')
        engineering_tab.click()
        page.wait_for_timeout(120)
        assert engineering_tab.get_attribute('aria-selected') == 'true'
        assert page.locator('#active-view').get_attribute('aria-labelledby') == 'tab-engineering'
        assert page.locator('.view-position').get_attribute('aria-label') == 'Section 14 of 19'
        assert page.locator('[role="tab"][tabindex="0"]').count() == 1
        engineering_tab.press('ArrowRight')
        page.wait_for_timeout(100)
        assert page.locator('[role="tab"][aria-selected="true"]').get_attribute('data-id') == 'stewardship'
        page.locator('[role="tab"][data-id="visuals"]').click()
        page.wait_for_timeout(100)"""
    s = replace_once(s, needle, extra, "browser Engineering navigation test")
s = s.replace(
    "still/device-reduced modes freeze, 18 views, mobile overflow 0",
    "still/device-reduced modes freeze, 19 views including Engineering, mobile overflow 0",
)
browser.write_text(s, encoding="utf-8")
