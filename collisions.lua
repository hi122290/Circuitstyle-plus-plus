-- collisions.lua
-- Strict Lua 5.1 implementation of AABB (Axis-Aligned Bounding Box) collision logic.
-- This module provides functions for detecting and resolving overlaps between boxes.

local Collisions = {}

-- Create a box structure: { x, y, z, hw, hh, hd }
-- cx, cy, cz: Center coordinates
-- hw, hh, hd: Half-extents (distance from center to edges)
function Collisions.new_box(cx, cy, cz, hw, hh, hd)
    return {
        x = cx or 0,
        y = cy or 0,
        z = cz or 0,
        hw = hw or 0.5,
        hh = hh or 0.5,
        hd = hd or 0.5
    }
end

-- Check if two AABBs overlap
function Collisions.check_overlap(a, b)
    if math.abs(a.x - b.x) > (a.hw + b.hw) then return false end
    if math.abs(a.y - b.y) > (a.hh + b.hh) then return false end
    if math.abs(a.z - b.z) > (a.hd + b.hd) then return false end
    return true
end

-- Resolve overlap by pushing box 'a' out of box 'b'
-- Returns a vector {x, y, z} representing the required displacement for 'a'
function Collisions.resolve_overlap(a, b)
    if not Collisions.check_overlap(a, b) then
        return { x = 0, y = 0, z = 0 }
    end

    -- Calculate penetrations on each axis
    local dx = (a.hw + b.hw) - math.abs(a.x - b.x)
    local dy = (a.hh + b.hh) - math.abs(a.y - b.y)
    local dz = (a.hd + b.hd) - math.abs(a.z - b.z)

    local displacement = { x = 0, y = 0, z = 0 }

    -- Find the axis of minimum penetration to resolve
    if dx < dy and dx < dz then
        displacement.x = (a.x > b.x) and dx or -dx
    elseif dy < dx and dy < dz then
        displacement.y = (a.y > b.y) and dy or -dy
    else
        displacement.z = (a.z > b.z) and dz or -dz
    end

    return displacement
end

-- Check if a point is inside a box
function Collisions.contains_point(box, px, py, pz)
    return math.abs(px - box.x) <= box.hw and
           math.abs(py - box.y) <= box.hh and
           math.abs(pz - box.z) <= box.hd
end

return Collisions