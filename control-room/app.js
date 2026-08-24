const contentContainer = document.getElementById('content');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const summary = document.getElementById('summary');
const inventorySignoff = document.getElementById('inventorySignoff');

let signageItems = [];
let inventoryMeta = {};

async function loadSignageContent() {
  try {
    const response = await fetch('signage-content.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      signageItems = data;
      inventoryMeta = {};
    } else {
      signageItems = data.items || [];
      inventoryMeta = data.meta || {};
    }

    populateCategoryFilter();
    renderSummary();
    renderSignoff();
    renderContent();

  } catch (error) {
    console.error('Could not load signage inventory:', error);

    contentContainer.innerHTML = `
      <div class="empty-state">
        <h2>Inventory unavailable</h2>
        <p>The signage-content.json file could not be loaded.</p>
      </div>
    `;

    summary.textContent = 'Inventory unavailable';
    inventorySignoff.textContent = '';
  }
}

function populateCategoryFilter() {
  const categories = [
    ...new Set(
      signageItems
        .map(item => item.category)
        .filter(Boolean)
    )
  ].sort();

  categoryFilter.innerHTML = `
    <option value="all">All categories</option>
    ${categories
      .map(category => `
        <option value="${escapeAttribute(category)}">
          ${escapeHtml(category)}
        </option>
      `)
      .join('')}
  `;
}

function renderSummary() {
  const total = signageItems.length;

  const live = signageItems.filter(
    item => item.status === 'live'
  ).length;

  const review = signageItems.filter(
    item => item.status === 'review'
  ).length;

  const assignmentCount = signageItems.reduce(
    (total, item) => {
      if (!Array.isArray(item.assignments)) {
        return total;
      }

      return total + item.assignments.filter(
        assignment => Boolean(assignment.device)
      ).length;
    },
    0
  );

  const unassigned = signageItems.filter(item => {
    if (!Array.isArray(item.assignments)) {
      return true;
    }

    return !item.assignments.some(
      assignment => Boolean(assignment.device)
    );
  }).length;

  summary.innerHTML = `
    <span><strong>${total}</strong> Web Modules</span>
    <span><strong>${live}</strong> Live</span>
    <span><strong>${review}</strong> Needs Review</span>
    <span><strong>${assignmentCount}</strong> Device Assignments</span>
    <span><strong>${unassigned}</strong> Modules Without Device</span>
  `;
}

function renderSignoff() {
  const name = inventoryMeta.lastEditedBy || 'Unknown';
  const initials = inventoryMeta.lastEditedInitials || '?';
  const timestamp = inventoryMeta.lastEditedAt || '';

  const notice =
    inventoryMeta.maintenanceNotice ||
    'This inventory is manually maintained.';

  let exactTime = 'Timestamp not recorded';
  let age = 'Age unknown';

  if (timestamp) {
    const date = new Date(timestamp);

    if (!Number.isNaN(date.getTime())) {
      exactTime = new Intl.DateTimeFormat(
        'en-CA',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }
      ).format(date);

      age = formatRelativeTime(date);
    }
  }

  inventorySignoff.innerHTML = `
    <div class="signoff-initials">
      ${escapeHtml(initials)}
    </div>

    <div class="signoff-copy">

      <span class="signoff-label">
        Inventory Sign-Off
      </span>

      <strong>
        ${escapeHtml(name)}
      </strong>

      <span class="signoff-date">
        Last edited ${escapeHtml(exactTime)}
      </span>

      <span class="signoff-age">
        ${escapeHtml(age)}
      </span>

      <small>
        ${escapeHtml(notice)}
      </small>

    </div>
  `;
}

function formatRelativeTime(date) {
  const difference = Date.now() - date.getTime();

  if (difference < 0) {
    return 'Timestamp is in the future';
  }

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) {
    return 'Updated just now';
  }

  if (minutes < 60) {
    return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (hours < 24) {
    return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (days < 7) {
    return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (days < 30) {
    return `Updated ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  if (days < 365) {
    return `Updated ${months} month${months === 1 ? '' : 's'} ago`;
  }

  return `Updated ${years} year${years === 1 ? '' : 's'} ago`;
}

function renderContent() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;

  const filteredItems = signageItems.filter(item => {
    const searchableText = [
      item.module,
      item.title,
      item.category,
      item.url,
      assignmentSearchText(item),
      item.location,
      item.notes
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch =
      !searchTerm ||
      searchableText.includes(searchTerm);

    const matchesCategory =
      selectedCategory === 'all' ||
      item.category === selectedCategory;

    const matchesStatus =
      selectedStatus === 'all' ||
      item.status === selectedStatus;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus
    );
  });

  if (!filteredItems.length) {
    contentContainer.innerHTML = `
      <div class="empty-state">
        <h2>No matching displays</h2>
        <p>Try changing your search or filters.</p>
      </div>
    `;

    return;
  }

  const groups = groupByCategory(filteredItems);

  contentContainer.innerHTML = Object.entries(groups)
    .map(([category, items]) => `
      <section class="content-group">

        <div class="group-heading">
          <h2>${escapeHtml(category)}</h2>
          <span>${items.length}</span>
        </div>

        <div class="card-grid">
          ${items.map(renderCard).join('')}
        </div>

      </section>
    `)
    .join('');

  attachCopyButtons();
}

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category || 'Other';

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push(item);

    return groups;
  }, {});
}

function assignmentSearchText(item) {
  if (!Array.isArray(item.assignments)) {
    return '';
  }

  return item.assignments
    .map(assignment => [
      assignment.device,
      assignment.channel
    ].filter(Boolean).join(' '))
    .join(' ');
}

function renderAssignments(item) {
  if (
    !Array.isArray(item.assignments) ||
    item.assignments.length === 0
  ) {
    return 'Not recorded';
  }

  return `
    <div class="assignment-list">
      ${item.assignments.map(assignment => `
        <div class="assignment">
          <strong>
            ${escapeHtml(assignment.device || 'Device not recorded')}
          </strong>

          ${
            assignment.channel
              ? `
                <span>
                  Channel: ${escapeHtml(assignment.channel)}
                </span>
              `
              : ''
          }
        </div>
      `).join('')}
    </div>
  `;
}

function renderCard(item) {
  const urlAvailable = Boolean(item.url);
  const moduleAvailable = Boolean(item.module);

  return `
    <article class="signage-card">

      <div class="card-top">

        <div class="card-badges">

          ${
            moduleAvailable
              ? `
                <span class="module-badge">
                  ${escapeHtml(item.module)}
                </span>
              `
              : ''
          }

          <span class="status status-${escapeHtml(item.status)}">
            ${escapeHtml(statusLabel(item.status))}
          </span>

        </div>

        <h3>${escapeHtml(item.title)}</h3>

      </div>

      <dl class="details">

        <div>
          <dt>Kuusoft</dt>
          <dd class="${
            item.assignments && item.assignments.length
              ? ''
              : 'missing'
          }">
            ${renderAssignments(item)}
          </dd>
        </div>

        <div>
          <dt>Location</dt>
          <dd class="${item.location ? '' : 'missing'}">
            ${item.location ? escapeHtml(item.location) : 'Not recorded'}
          </dd>
        </div>

        <div>
          <dt>Public URL</dt>
          <dd class="${urlAvailable ? '' : 'missing'}">
            ${
              urlAvailable
                ? `
                  <a
                    href="${escapeAttribute(item.url)}"
                    target="_blank"
                    rel="noopener"
                  >
                    ${escapeHtml(item.url)}
                  </a>
                `
                : 'Not recorded'
            }
          </dd>
        </div>

        ${
          item.notes
            ? `
              <div>
                <dt>Notes</dt>
                <dd>${escapeHtml(item.notes)}</dd>
              </div>
            `
            : ''
        }

      </dl>

      <div class="card-actions">

        ${
          urlAvailable
            ? `
              <a
                class="button button-primary"
                href="${escapeAttribute(item.url)}"
                target="_blank"
                rel="noopener"
              >
                Open Display
              </a>

              <button
                class="button button-secondary copy-url"
                type="button"
                data-url="${escapeAttribute(item.url)}"
              >
                Copy URL
              </button>
            `
            : `
              <span class="button button-disabled">
                URL Not Recorded
              </span>
            `
        }

      </div>

    </article>
  `;
}

function attachCopyButtons() {
  document.querySelectorAll('.copy-url').forEach(button => {
    button.addEventListener('click', async () => {
      const url = button.dataset.url;

      try {
        await navigator.clipboard.writeText(url);

        const originalText = button.textContent;

        button.textContent = 'Copied';

        setTimeout(() => {
          button.textContent = originalText;
        }, 1400);

      } catch (error) {
        console.error('Could not copy URL:', error);
      }
    });
  });
}

function statusLabel(status = '') {
  const labels = {
    review: 'Needs Review',
    live: 'Live',
    testing: 'Testing',
    standby: 'Standby',
    retired: 'Retired'
  };

  return labels[status] || capitalize(status);
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}

searchInput.addEventListener('input', renderContent);
categoryFilter.addEventListener('change', renderContent);
statusFilter.addEventListener('change', renderContent);

loadSignageContent();
