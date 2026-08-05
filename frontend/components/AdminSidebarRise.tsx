import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { RiseColors } from '../constants/riseTheme';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/(admin)/dashboard-new' },
  { id: 'events', label: 'Events', icon: 'calendar-outline', route: '/(admin)/appointments' },
  { id: 'clients', label: 'Clients', icon: 'briefcase-outline', route: '/(admin)/clients' },
  { id: 'projects', label: 'Projects', icon: 'layers-outline', route: '/(admin)/documents-management' },
  { id: 'tasks', label: 'Tasks', icon: 'checkmark-circle-outline', route: '/(admin)/appointments' },
  { id: 'leads', label: 'Leads', icon: 'people-outline', route: '/(admin)/clients' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'repeat-outline', route: '/(admin)/subscriptions-management' },
  { id: 'sales', label: 'Sales', icon: 'cart-outline', route: '/(admin)/service-prices' },
  { id: 'prospects', label: 'Prospects', icon: 'person-add-outline', route: '/(admin)/clients' },
  { id: 'zapier', label: 'Zapier Management', icon: 'git-network-outline', route: '/(admin)/rise-sync-panel' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline', route: '/(admin)/documents-management' },
  { id: 'messages', label: 'Messages', icon: 'chatbubbles-outline', route: '/(admin)/whatsapp-conversations' },
  { id: 'team', label: 'Team', icon: 'people-circle-outline', route: '/(admin)/clients' },
];

export default function AdminSidebarRise() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (route: string) => {
    return pathname === route;
  };

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={styles.sidebar}>
      {/* Logo Header - Rise Style */}
      <View style={styles.logoContainer}>
        <LinearGradient
          colors={['#00BCD4', '#E91E63', '#FFC107']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logoGradient}
        >
          <Text style={styles.logoText}>R</Text>
        </LinearGradient>
        <View style={styles.logoTextContainer}>
          <Text style={styles.logoTitle}>RISE</Text>
          <Text style={styles.logoSubtitle}>Ross Tax Admin</Text>
        </View>
      </View>

      {/* Top Icons */}
      <View style={styles.topIcons}>
        <TouchableOpacity style={styles.topIcon}>
          <Ionicons name="search-outline" size={20} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topIcon}>
          <Ionicons name="globe-outline" size={20} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topIcon}>
          <Ionicons name="close-outline" size={20} color={RiseColors.textGray} />
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <ScrollView 
        style={styles.menuContainer}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => handleNavigation(item.route)}
              activeOpacity={0.7}
            >
              {active && <View style={styles.activeIndicator} />}
              <Ionicons 
                name={item.icon as any} 
                size={20} 
                color={active ? RiseColors.white : RiseColors.textGray}
              />
              <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                {item.label}
              </Text>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Menu Icon (Collapsed sections) */}
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="menu-outline" size={20} color={RiseColors.textGray} />
          <Text style={styles.menuItemText}>More</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Navigation - Rise Style */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="menu-outline" size={22} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="checkmark-circle-outline" size={22} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="briefcase-outline" size={22} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="chatbubbles-outline" size={22} color={RiseColors.textGray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="add-circle-outline" size={22} color={RiseColors.textGray} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: 240,
    backgroundColor: RiseColors.white,
    borderRightWidth: 1,
    borderRightColor: RiseColors.border,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: RiseColors.border,
  },
  logoGradient: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: RiseColors.white,
    letterSpacing: 1,
  },
  logoTextContainer: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: RiseColors.text,
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 11,
    color: RiseColors.textGray,
    marginTop: 2,
  },
  topIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: RiseColors.border,
  },
  topIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: RiseColors.backgroundGray,
  },
  menuContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: RiseColors.primary,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: RiseColors.white,
  },
  menuItemText: {
    fontSize: 14,
    color: RiseColors.textGray,
    fontWeight: '500',
    flex: 1,
  },
  menuItemTextActive: {
    color: RiseColors.white,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: RiseColors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: RiseColors.white,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: RiseColors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    backgroundColor: RiseColors.white,
  },
  bottomNavItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
