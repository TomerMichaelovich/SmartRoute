import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface ProductGroup {
  department: string;
  products: Product[];
}

interface ProductPickerModalProps {
  visible: boolean;
  productsByDepartment: ProductGroup[];
  selectedProductId: string;
  onSelect: (productId: string | null) => void;
  onClose: () => void;
}

// RN stand-in for the web's <select><optgroup> dropdown (no native equivalent in RN
// without adding a picker dependency) - a full-screen modal list grouped by department,
// tap a row to pick it.
export function ProductPickerModal({
  visible,
  productsByDepartment,
  selectedProductId,
  onSelect,
  onClose,
}: ProductPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{he.review.chooseProduct}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
            >
              <Text style={styles.rowText}>{he.review.noMatch}</Text>
            </Pressable>
            {productsByDepartment.map((group) => (
              <View key={group.department}>
                <Text style={styles.sectionHeader}>{group.department}</Text>
                {group.products.map((product) => (
                  <Pressable
                    key={product.id}
                    style={styles.row}
                    onPress={() => {
                      onSelect(product.id);
                      onClose();
                    }}
                  >
                    <Text style={[styles.rowText, product.id === selectedProductId && styles.rowTextSelected]}>
                      {product.canonicalName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  title: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  close: {
    fontSize: 18,
    color: COLORS.neutral500,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.neutral500,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  rowTextSelected: {
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
});
