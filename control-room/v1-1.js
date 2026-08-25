const cmsLaunchpad = document.getElementById('cmsLaunchpad');
const systemsHierarchy = document.getElementById('systemsHierarchy');

async function loadControlRoomResources() {
  try {
    const response = await fetch('control-room-resources.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    renderCmsLaunchpad(data.cms || []);
    renderSystemsHierarchy(data.systems || []);
  } catch (error) {
    console.error('Could not load Control Room resources:', error);

    if (cmsLaunchpad) {
      cmsLaunchpad.innerHTML = `
        <div class="resource-error">
          Administration resource directory unavailable.
        </div>
      `;
    }

    if (systemsHierarchy) {
      systemsHierarchy.innerHTML = `
        <div class="resource-error">
          Systems resource directory unavailable.
        </div>
      `;
    }
  }
}

function renderCmsLaunchpad(items) {
  if (!cmsLaunchpad) {
    return;
  }

  cmsLaunchpad.innerHTML = items.map(item => `
    <article class="cms-card cms-card-${escapeResourceAttribute(item.status || 'live')}">
      <div class="cms-card-head">
        <span class="cms-eyebrow">${escapeResourceHtml(item.eyebrow || '')}</span>
        <span class="cms-status">${escapeResourceHtml(resourceStatusLabel(item.status))}</span>
      </div>

      <h3>${escapeResourceHtml(item.name || '')}</h3>

      <p class="cms-description">
        ${escapeResourceHtml(item.description || '')}
      </p>

      ${renderFlow(item.flow)}

      <div class="cms-actions">
        <a
          class="resource-button resource-button-admin"
          href="${escapeResourceAttribute(item.adminUrl || '#')}"
          target="_blank"
          rel="noopener"
        >
          Open Admin
        </a>

        <a
          class="resource-button resource-button-docs"
          href="${escapeResourceAttribute(item.documentationUrl || '#')}"
        >
          Documentation
        </a>
      </div>
    </article>
  `).join('');
}

function renderFlow(flow) {
  if (!Array.isArray(flow) || flow.length === 0) {
    return '';
  }

  return `
    <div class="system-flow" aria-label="System flow">
      ${flow.map((step, index) => `
        ${index ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}
        <span>${escapeResourceHtml(step)}</span>
      `).join('')}
    </div>
  `;
}

function renderSystemsHierarchy(items) {
  if (!systemsHierarchy) {
    return;
  }

  systemsHierarchy.innerHTML = items.map((item, index) => `
    <article class="system-card">
      <div class="system-order">${String(index + 1).padStart(2, '0')}</div>

      <div class="system-card-content">
        <p class="system-role">${escapeResourceHtml(item.role || '')}</p>
        <h3>${escapeResourceHtml(item.service || '')}</h3>

        <div class="system-hierarchy">
          <span>${escapeResourceHtml(item.organization || '')}</span>
          <span aria-hidden="true">└─</span>
          <strong>${escapeResourceHtml(item.resource || '')}</strong>
        </div>

        <p>${escapeResourceHtml(item.description || '')}</p>

        ${renderSystemLinks(item.links)}
      </div>
    </article>
  `).join('');
}

function renderSystemLinks(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return `
      <span class="resource-note">
        Reference link pending verified organizational URL
      </span>
    `;
  }

  return `
    <div class="system-links">
      ${links.map(link => `
        <a
          href="${escapeResourceAttribute(link.url || '#')}"
          target="_blank"
          rel="noopener"
        >
          ${escapeResourceHtml(link.label || 'Open')}
        </a>
      `).join('')}
    </div>
  `;
}

function resourceStatusLabel(status = '') {
  const labels = {
    live: 'Production',
    testing: 'Testing',
    standby: 'Standby'
  };

  return labels[status] || status;
}

function escapeResourceHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeResourceAttribute(value = '') {
  return escapeResourceHtml(value);
}

loadControlRoomResources();
