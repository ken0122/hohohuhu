const SUPPORTED_SUITES = new Set(["smoke", "focus", "soak", "release"]);

function parseTags(value) {
  return (value || "")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function createDesktopTestSelection(env = process.env) {
  const suite = env.BLUEPET_TEST_SUITE || "release";
  if (!SUPPORTED_SUITES.has(suite)) {
    throw new Error(`Unsupported BLUEPET_TEST_SUITE: ${suite}`);
  }

  const requestedTags = parseTags(env.BLUEPET_TEST_TAGS);
  const filter = env.BLUEPET_TEST_MATCH || null;
  const namePattern = filter ? new RegExp(filter) : null;

  return {
    suite,
    requestedTags,
    filter,
    matches(name, tags) {
      if (namePattern && !namePattern.test(name)) return false;
      if (suite !== "release" && !tags.includes(suite)) return false;
      if (requestedTags.length && !requestedTags.some(tag => tags.includes(tag))) return false;
      return true;
    },
  };
}
