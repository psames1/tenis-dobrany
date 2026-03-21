/**
 * Visibility helper — mapuje roli uživatele na povolené hodnoty sloupce `visibility`.
 *
 * Hierarchie viditelnosti:
 *   public  → vidí všichni (nepřihlášení i přihlášení)
 *   member  → přihlášení členové (a výše)
 *   editor  → manager a admin
 *   admin   → pouze administrátor
 */

export function visibilitiesForRole(role: string | null | undefined): string[] {
  if (role === 'admin')   return ['public', 'member', 'editor', 'admin']
  if (role === 'manager') return ['public', 'member', 'editor']
  if (role)               return ['public', 'member'] // member, contributor
  return ['public']
}
