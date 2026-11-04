// Extracted from MainListSkill's arrays; gunner plash/frame values include the
// division by two performed in ListSkill.setFireSkill.
// Each row is [internalSkillId, effectivePlash, effectTick, effectId].
const byClass = [
  [
    [15,0,5,21],[23,1,9,28],[41,1,9,52],[21,5,11,26],[5,5,11,11],
    [42,7,15,53],[43,7,15,54],[42,7,15,53],[5,5,11,11],[0,0,5,0],
    [0,0,5,0],[0,0,5,0],[0,0,5,0],[45,9,5,57],[45,9,5,57],[0,0,5,0],
    [0,0,5,0],[54,0,5,110],[58,0,5,0],[64,0,5,116],[68,0,5,120],
  ],
  [
    [15,0,5,21],[44,1,9,55],[36,1,9,46],[22,1,9,27],[37,5,11,47],
    [27,4,9,34],[34,7,15,40],[27,4,9,34],[14,7,15,20],[0,0,5,0],
    [0,0,5,0],[0,0,5,0],[0,0,5,0],[45,9,5,57],[45,9,5,57],[0,0,5,0],
    [0,0,5,0],[55,0,5,112],[60,0,5,0],[65,0,5,117],[69,0,5,121],
  ],
  [
    [31,0,5,38],[46,1,9,59],[20,1,9,25],[39,5,11,49],[51,5,11,64],
    [6,7,15,12],[48,2,15,61],[47,7,15,60],[48,2,15,61],[0,0,5,0],
    [0,0,5,0],[0,0,5,0],[0,0,5,0],[45,9,5,57],[45,9,5,57],[0,0,5,0],
    [0,0,5,0],[56,0,5,109],[61,0,5,0],[62,0,5,119],[66,0,5,123],
  ],
  [
    [31,0,5,38],[19,8,4,23],[18,8,4,22],[24,5,5,31],[40,3,5,51],
    [49,6,5,62],[50,5,5,82],[52,5,10,65],[53,5,10,66],[0,0,5,0],
    [0,0,5,0],[0,0,5,0],[0,0,5,0],[45,4,2,57],[45,4,2,57],[0,0,5,0],
    [0,0,5,0],[57,0,2,111],[59,0,5,0],[63,0,2,118],[67,0,2,122],
  ],
]

export const SKILL_CATEGORIES = [
  'attack','attack','attack','attack','attack','attack','attack','attack','attack',
  'passive','passive','passive','self-buff','self-buff','self-buff','passive','passive',
  'control','party-buff','area','area',
]

export function clientSkillData(clazz, skillId) {
  if (!Number.isInteger(clazz) || clazz < 0 || clazz > 3 || !Number.isInteger(skillId) || skillId < 0 || skillId > 20) return null
  const [internalSkillId, plashType, effectTick, effectId] = byClass[clazz][skillId]
  return { clazz, skillId, internalSkillId, plashType, effectTick, effectId, category: SKILL_CATEGORIES[skillId] }
}

export function hasClientSkillMapping(clazz, skillId) {
  return Boolean(clientSkillData(clazz, skillId))
}

export function isClientAttackSkill(clazz, skillId) {
  const skill = clientSkillData(clazz, skillId)
  return Boolean(skill && ['attack','control','area'].includes(skill.category) && skillId > 0)
}
