// An explicit editable trial, not recovered client animation data.
export function createAttackTrial({ preparePose = 3, strikePose = 4, prepareAnchor = preparePose, strikeAnchor = strikePose, clazz = 0, skillId = 0, fps = 8 } = {}) {
  for (const pose of [preparePose, strikePose]) if (!Number.isInteger(pose) || pose < 0 || pose > 4) throw new Error('Attack crop pose must be 0–4')
  for (const anchor of [prepareAnchor, strikeAnchor]) if (!Number.isInteger(anchor) || anchor < 0 || anchor > 5) throw new Error('Attack anchor pose must be 0–5')
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error('Invalid attack preview FPS')
  return {
    experimental: true, provenance: 'studio-trial', fps, repeat: 0, clazz, skillId, preparePose, strikePose, prepareAnchor, strikeAnchor,
    frames: [{ pose: 0, anchorPose: 0 }, { pose: preparePose, anchorPose: prepareAnchor }, { pose: strikePose, anchorPose: strikeAnchor }, { pose: 0, anchorPose: 0 }].map(frame => ({ ...frame, idleOffset: 0 })),
    limitations: ['PNG/crop/offset lấy từ packet gốc.', 'Chuỗi pose, liên kết crop–anchor và FPS là thử nghiệm, chưa xác minh từ client.', 'Các phái dùng chung chuỗi thử; dữ liệu kỹ năng từng phái giữ nguyên từ server.', 'Chưa gắn vũ khí, hiệu ứng hoặc sự kiện gây sát thương.'],
  }
}
