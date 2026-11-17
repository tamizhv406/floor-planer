import { furnitureLayer, resolveFurniture } from '../furniture/catalog'
import { deleteZone, distanceToSegment, type Plan, type Point } from '../model'
import { pointInPolygon } from '../stats/rooms'
import { deletePlan, emptySel } from './selection/model'

export type EraseKind = 'furniture' | 'openings' | 'walls' | 'zones'
export type EraseTarget = { kind: EraseKind; id: string }

/**
 * What the eraser would delete at world point `p`. Topmost first: furniture
 * (by draw layer, later items above earlier), then doors/windows, walls, and
 * site zones. `tol` widens hit areas (mm) so thin items are easy to tap.
 * Locked layers and locked zones are skipped.
 */
export function eraseTargetAt(plan: Plan, p: Point, tol: number, locked: Partial<Record<'walls' | 'furniture' | 'zones', boolean>>): EraseTarget | null {
  if (!locked.furniture) {
    const order = plan.furniture.map((f, i) => ({ f, i })).sort((a, b) => furnitureLayer(b.f.type) - furnitureLayer(a.f.type) || b.i - a.i)
    for (const { f } of order) {
      const { w, d } = resolveFurniture(f)
      const rad = (-(f.rotationDeg ?? 0) * Math.PI) / 180
      const dx = p.x - f.x
      const dy = p.y - f.y
      const u = dx * Math.cos(rad) - dy * Math.sin(rad)
      const v = dx * Math.sin(rad) + dy * Math.cos(rad)
      if (Math.abs(u) <= w / 2 + tol && Math.abs(v) <= d / 2 + tol) return { kind: 'furniture', id: f.id }
    }
  }
  if (!locked.walls) {
    for (const o of plan.openings) {
      const wall = plan.walls.find((x) => x.id === o.wallId)
      if (!wall) continue
      const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
      if (len < 1) continue
      const ux = (wall.b.x - wall.a.x) / len
      const uy = (wall.b.y - wall.a.y) / len
      const along = (p.x - wall.a.x) * ux + (p.y - wall.a.y) * uy
      const across = Math.abs(-(p.x - wall.a.x) * uy + (p.y - wall.a.y) * ux)
      if (along >= o.offset - tol && along <= o.offset + o.width + tol && across <= wall.thickness / 2 + tol) return { kind: 'openings', id: o.id }
    }
    for (const wall of plan.walls) {
      if (distanceToSegment(p, wall.a, wall.b) <= wall.thickness / 2 + tol) return { kind: 'walls', id: wall.id }
    }
  }
  if (!locked.zones) {
    const zones = plan.site.zones ?? []
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i]
      if (!z.locked && z.polygon.length >= 3 && pointInPolygon(p, z.polygon)) return { kind: 'zones', id: z.id }
    }
  }
  return null
}

/** Plan without the target; deleting a wall also removes its doors and windows. */
export function eraseTarget(plan: Plan, t: EraseTarget): Plan {
  if (t.kind === 'zones') return deleteZone(plan, t.id)
  return deletePlan(plan, { ...emptySel(), [t.kind]: [t.id] })
}
