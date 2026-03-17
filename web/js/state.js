export const state = {
  participants: [],
  cohorts: null,
  filtered: [],
  selectedKey: null,
  filters: {
    name: "",
    bib: "",
    event: "ALL",
  },
};

export function setParticipants(participants) {
  state.participants = participants;
  state.filtered = participants;
}

export function setCohorts(cohorts) {
  state.cohorts = cohorts;
}

export function setFilter(partial) {
  state.filters = { ...state.filters, ...partial };
}

export function setSelectedKey(key) {
  state.selectedKey = key;
}

export function getParticipantKey(athlete) {
  return `${athlete.event}__${athlete.bibNo}__${athlete.name}`.toLowerCase();
}

export function applyFilters() {
  const nameNeedle = state.filters.name.trim().toLowerCase();
  const bibNeedle = state.filters.bib.trim().toLowerCase();
  const eventNeedle = state.filters.event;
  state.filtered = state.participants.filter((athlete) => {
    const matchesName =
      !nameNeedle || athlete.name.toLowerCase().includes(nameNeedle);
    const matchesBib =
      !bibNeedle || String(athlete.bibNo).toLowerCase().includes(bibNeedle);
    const matchesEvent = eventNeedle === "ALL" || athlete.event === eventNeedle;
    return matchesName && matchesBib && matchesEvent;
  });
  return state.filtered;
}
