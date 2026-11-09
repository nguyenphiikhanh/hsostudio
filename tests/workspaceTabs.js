// Route UI actions through the same visible tab a user would choose.
export async function inCharacterTab(page, tab, action) {
  const control = page.getByRole('tab', {name:tab, exact:true})
  if(await control.getAttribute('aria-selected') !== 'true') await control.click()
  return action()
}
