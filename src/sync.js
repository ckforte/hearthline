const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

export function reconcileSection(base, local, remote) {
  if (same(local, remote)) return { resolved: true, data: local }
  if (same(local, base)) return { resolved: true, data: remote }
  if (same(remote, base)) return { resolved: true, data: local }

  if (!Array.isArray(base) || !Array.isArray(local) || !Array.isArray(remote)) {
    return { resolved: false }
  }
  if (![...base, ...local, ...remote].every(item => item && typeof item === 'object' && item.id)) {
    return { resolved: false }
  }

  const baseById = new Map(base.map(item => [item.id, item]))
  const localById = new Map(local.map(item => [item.id, item]))
  const remoteById = new Map(remote.map(item => [item.id, item]))
  const order = [...new Set([...remote.map(item => item.id), ...local.map(item => item.id)])]
  const merged = []

  for (const id of order) {
    const before = baseById.get(id)
    const mine = localById.get(id)
    const theirs = remoteById.get(id)
    const mineChanged = !same(mine, before)
    const theirsChanged = !same(theirs, before)
    if (mineChanged && theirsChanged && !same(mine, theirs)) return { resolved: false }
    const chosen = mineChanged ? mine : theirs
    if (chosen !== undefined) merged.push(chosen)
  }
  return { resolved: true, data: merged }
}
