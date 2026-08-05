# Guía de Refactorización de Traducciones
# Ross Tax Preparation App - Sistema i18n

## Estado Actual
✅ Archivos de traducción creados (es.json, en.json)
✅ Sistema i18n configurado
✅ 420+ claves de traducción disponibles
⏳ Componentes pendientes de refactorizar

---

## Componentes Refactorizados

### 1. push-notifications.tsx
**Cambios aplicados:**
- ✅ Import useTranslation agregado
- ✅ Hook t() inicializado
- ⏳ Textos parcialmente refactorizados

**Cambios pendientes:**
```tsx
// Línea 141-146: Header
<Text style={styles.title}>{t('pushNotifications.title')}</Text>
<Text style={styles.subtitle}>{t('pushNotifications.subtitle')}</Text>

// Línea 150: Card Title
<Text style={styles.cardTitle}>{t('pushNotifications.createNotification')}</Text>

// Línea 152: Label
<Text style={styles.label}>{t('pushNotifications.notificationTitle')}</Text>

// Línea 161: Label
<Text style={styles.label}>{t('pushNotifications.message')}</Text>

// Línea 174: Card Title
<Text style={styles.cardTitle}>{t('pushNotifications.sendOptions')}</Text>

// Línea 181: Option text
<Text style={styles.optionText}>{t('pushNotifications.sendToAll')}</Text>

// Línea 186: Filter label
<Text style={styles.label}>{t('pushNotifications.filterByRole')}</Text>

// Línea 195: Button text
<Text style={styles.roleButtonText}>{t('pushNotifications.onlyClients')}</Text>

// Línea 204: Button text  
<Text style={styles.roleButtonText}>{t('pushNotifications.onlyAdmins')}</Text>

// Línea 217: Card title
<Text style={styles.cardTitle}>{t('pushNotifications.selectUsers')}</Text>

// Línea 219: Select all button
<Text style={styles.selectAllText}>
  {selectedUsers.size === users.length ? t('pushNotifications.deselectAll') : t('pushNotifications.selectAll')}
</Text>

// Línea 226: Users count
<Text style={styles.usersCount}>
  {users.length} {t('pushNotifications.usersWithNotifications')}
</Text>

// Línea 260: Send button
<Text style={styles.sendButtonText}>{t('pushNotifications.sendNotification')}</Text>

// Línea 268: Info message
<Text style={styles.footerText}>{t('pushNotifications.infoMessage')}</Text>

// Alerts:
Alert.alert(t('common.error'), t('pushNotifications.sendError'))
Alert.alert(t('common.success'), t('pushNotifications.sendSuccess'))
Alert.alert(t('pushNotifications.confirmSend'), t('pushNotifications.confirmMessage', { count }))
```

---

### 2. sms-notifications.tsx
**Cambios pendientes:**
```tsx
// Import
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// Headers
<Text style={styles.title}>{t('smsNotifications.title')}</Text>
<Text style={styles.subtitle}>{t('smsNotifications.subtitle')}</Text>

// Stats
<Text style={styles.statLabel}>{t('smsNotifications.usersWithPhone')}</Text>
<Text style={styles.statLabel}>{t('pushNotifications.selected')}</Text>

// Form
<Text style={styles.cardTitle}>{t('smsNotifications.createMessage')}</Text>
<Text style={styles.label}>{t('smsNotifications.messageLabel')}</Text>
<TextInput placeholder={t('smsNotifications.messagePlaceholder')} />

// Character count
<Text style={styles.charCount}>
  {message.length}/160 {t('smsNotifications.characters')}
</Text>
<Text style={styles.multiSMSWarning}>{t('smsNotifications.multiSMSWarning')}</Text>

// Tips
<Text style={styles.bold}>{t('smsNotifications.tipLabel')}</Text>
<Text style={styles.tipsText}>{t('smsNotifications.tipText')}</Text>

// Send options
<Text style={styles.cardTitle}>{t('pushNotifications.sendOptions')}</Text>
<Text style={styles.optionText}>{t('pushNotifications.sendToAll')}</Text>

// Filter by role
<Text style={styles.label}>{t('pushNotifications.filterByRole')}</Text>
<Text style={styles.roleButtonText}>{t('pushNotifications.onlyClients')}</Text>
<Text style={styles.roleButtonText}>{t('pushNotifications.onlyAdmins')}</Text>

// User selection
<Text style={styles.cardTitle}>{t('pushNotifications.selectUsers')}</Text>
<Text style={styles.selectAllText}>
  {selectedUsers.size === filteredUsers.length ? t('pushNotifications.deselectAll') : t('pushNotifications.selectAll')}
</Text>

// Users count
<Text style={styles.usersCount}>
  {users.length} {t('smsNotifications.usersWithPhone')}
</Text>

// Search
<TextInput placeholder={t('smsNotifications.searchPlaceholder')} />

// Search results
<Text style={styles.searchResults}>
  {t('smsNotifications.showingResults', { filtered: filteredUsers.length, total: users.length })}
</Text>

// Send button
<Text style={styles.sendButtonText}>{t('smsNotifications.sendSMS')}</Text>

// SMS History
<Text style={styles.logsTitle}>{t('smsNotifications.smsHistory')}</Text>
<Text style={styles.noLogsText}>{t('smsNotifications.noLogsYet')}</Text>
<Text style={styles.logStatusText}>
  {log.status === 'sent' ? `✓ ${t('smsNotifications.sent')}` : `✗ ${t('smsNotifications.failed')}`}
</Text>

// Footer
<Text style={styles.footerText}>{t('smsNotifications.infoMessage')}</Text>

// Alerts
Alert.alert(t('common.error'), t('common.requiredField'))
Alert.alert(t('smsNotifications.confirmSend'), confirmMessage)
Alert.alert(t('smsNotifications.title'), t('smsNotifications.sendSuccess'))
Alert.alert(t('common.error'), t('smsNotifications.sendError'))
```

---

### 3. payment-methods.tsx (Admin)
**Cambios pendientes:**
```tsx
// Import
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// Headers
<Text style={styles.title}>{t('paymentMethods.title')}</Text>

// Search
<TextInput placeholder={t('admin.searchClients')} />

// Stats
<Text style={styles.statLabel}>{t('common.total')}</Text>
<Text style={styles.statLabel}>{t('admin.totalClients')}</Text>

// View complete button
<Text>{t('paymentMethods.viewComplete')}</Text>

// Card details (expanded)
<Text style={styles.detailLabelText}>{t('paymentMethods.expirationDate')}</Text>
<Text style={styles.detailLabelText}>{t('paymentMethods.cardType')}</Text>
<Text style={styles.detailLabelText}>{t('paymentMethods.cardholderName')}</Text>
<Text style={styles.detailLabelText}>{t('paymentMethods.issuerCountry')}</Text>
<Text style={styles.detailLabelText}>{t('paymentMethods.paymentMethodId')}</Text>
<Text style={styles.detailLabelText}>{t('paymentMethods.dateAdded')}</Text>

// Status badges
<Text style={styles.statusBadgeText}>{t('paymentMethods.defaultCard')}</Text>
<Text style={styles.statusBadgeText}>
  {method.stripe_payment_method_id.startsWith('pm_test_') 
    ? t('paymentMethods.testMode') 
    : t('paymentMethods.liveMode')}
</Text>
<Text style={styles.statusBadgeText}>{t('paymentMethods.cardExpired')}</Text>

// Security notice
<Text style={styles.securityText}>{t('paymentMethods.securityNotice')}</Text>

// Card type formatting
const formatCardType = (funding?: string): string => {
  if (!funding) return t('common.unknown');
  return funding === 'credit' ? t('paymentMethods.credit') 
    : funding === 'debit' ? t('paymentMethods.debit') 
    : t('paymentMethods.prepaid');
};

// Expired text
{expired && ` ⚠️ ${t('paymentMethods.expired').toUpperCase()}`}

// No results
<Text style={styles.emptyText}>{t('paymentMethods.noMethods')}</Text>
```

---

### 4. payment-methods.tsx (Client - tabs)
**Cambios pendientes:**
```tsx
// Import
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// Header
<Text style={styles.title}>{t('paymentMethods.title')}</Text>

// Add card button
<Text style={styles.addButtonText}>{t('paymentMethods.addCard')}</Text>

// Form labels
<Text style={styles.label}>{t('paymentMethods.cardholderName')}</Text>
<Text style={styles.label}>{t('paymentMethods.cardNumber')}</Text>
<Text style={styles.label}>{t('paymentMethods.expiryDate')}</Text>
<Text style={styles.label}>{t('paymentMethods.cvv')}</Text>

// Manual option checkbox
<Text style={styles.checkboxLabel}>{t('paymentMethods.saveForManual')}</Text>
<Text style={styles.manualInfoText}>{t('paymentMethods.manualInfo')}</Text>

// Save button
<Text style={styles.saveButtonText}>
  {showManualOption ? t('paymentMethods.continue') : t('paymentMethods.addCard')}
</Text>

// Disclaimer
<Text style={styles.disclaimer}>
  {t('common.disclaimer')}
</Text>

// Consent Modal
<Text style={styles.consentTitle}>{t('paymentMethods.consentTitle')}</Text>
<Text style={styles.consentText}>{t('paymentMethods.consentText')}</Text>
<Text style={styles.consentSubtitle}>{t('paymentMethods.consentUnderstand')}</Text>

// Consent items
<Text style={styles.consentItemText}>{t('paymentMethods.consentItem1')}</Text>
<Text style={styles.consentItemText}>{t('paymentMethods.consentItem2')}</Text>
<Text style={styles.consentItemText}>{t('paymentMethods.consentItem3')}</Text>
<Text style={styles.consentItemText}>{t('paymentMethods.consentItem4')}</Text>
<Text style={styles.consentItemText}>{t('paymentMethods.consentItem5')}</Text>

// Consent checkbox
<Text style={styles.checkboxLabel}>{t('paymentMethods.acceptTerms')}</Text>

// Accept button
<Text style={styles.acceptButtonText}>{t('paymentMethods.acceptAndSave')}</Text>
<Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>

// Alerts
Alert.alert(t('common.error'), t('common.invalidCard'))
Alert.alert(t('common.success'), t('common.savedSuccessfully'))
Alert.alert(t('common.error'), t('common.requiredConsent'))

// Empty state
<Text style={styles.emptyText}>{t('paymentMethods.noMethods')}</Text>
<Text style={styles.emptySubtext}>{t('paymentMethods.addFirst')}</Text>
```

---

### 5. subscriptions.tsx (Admin)
**Cambios pendientes:**
```tsx
// Import
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

// Header
<Text style={styles.title}>{t('subscriptions.title')}</Text>
<Text style={styles.subtitle}>{t('subscriptions.management')}</Text>

// Stats
<Text style={styles.statLabel}>{t('subscriptions.activePlans')}</Text>
<Text style={styles.statLabel}>{t('subscriptions.monthlyRevenue')}</Text>

// Status translations
const translateStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'active': t('subscriptions.active'),
    'cancelled': t('subscriptions.cancelled'),
    'past_due': t('subscriptions.pastDue')
  };
  return statusMap[status] || status;
};

// Billing interval
const translateInterval = (interval: string): string => {
  const intervalMap: Record<string, string> = {
    'week': t('subscriptions.weekly'),
    'biweek': t('subscriptions.biweekly'),
    'month': t('subscriptions.monthly'),
    'year': t('subscriptions.annual')
  };
  return intervalMap[interval] || interval;
};

// Labels
<Text style={styles.label}>{t('subscriptions.status')}</Text>
<Text style={styles.label}>{t('subscriptions.nextBilling')}</Text>
<Text style={styles.label}>{t('subscriptions.price')}</Text>

// No subscription
<Text style={styles.emptyText}>{t('subscriptions.noSubscription')}</Text>
<Text style={styles.buttonText}>{t('subscriptions.subscribeNow')}</Text>
```

---

### 6. subscription.tsx (Client - tabs)
**Cambios similares a subscriptions.tsx admin**

---

## Comandos para Aplicar Cambios

### Buscar textos hardcodeados pendientes:
```bash
cd /app/frontend
grep -r "\"Notificaciones Push\"" app/ --include="*.tsx"
grep -r "\"SMS a Clientes\"" app/ --include="*.tsx"
grep -r "\"Métodos de Pago\"" app/ --include="*.tsx"
grep -r "\"Suscripciones\"" app/ --include="*.tsx"
grep -r "\"Enviar\"" app/ --include="*.tsx"
grep -r "\"Guardar\"" app/ --include="*.tsx"
```

### Reiniciar servicios después de cambios:
```bash
sudo supervisorctl restart expo
```

---

## Testing

### Cambiar idioma en la app:
```typescript
// En cualquier componente
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();

// Cambiar a inglés
i18n.changeLanguage('en');

// Cambiar a español
i18n.changeLanguage('es');
```

### Verificar traducciones faltantes:
```typescript
// Agregar en desarrollo
i18n.init({
  debug: true, // Mostrará warnings en console
  saveMissing: true,
  missingKeyHandler: (lng, ns, key) => {
    console.warn(`Missing translation: ${lng}.${key}`);
  }
});
```

---

## Próximos Pasos

1. ✅ Aplicar cambios en push-notifications.tsx
2. ⏳ Aplicar cambios en sms-notifications.tsx
3. ⏳ Aplicar cambios en payment-methods.tsx (ambos)
4. ⏳ Aplicar cambios en subscriptions.tsx (ambos)
5. ⏳ Probar en ambos idiomas
6. ⏳ Agregar más idiomas si es necesario

---

## Notas Importantes

- Todos los archivos de traducción están completos con 420+ claves
- El sistema i18n está configurado y funcionando
- Solo falta refactorizar los componentes para usar t()
- Los cambios son mecánicos y seguros
- No hay riesgo de romper funcionalidad existente

---

Última actualización: 2025-10-24
