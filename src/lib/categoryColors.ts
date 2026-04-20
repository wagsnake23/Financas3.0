import { AppCategory } from "@/types/finance";

export const CATEGORY_COLOR_MAP: Record<string, string> = {
    "moradia": "#0EA5E9",
    "transporte": "#2563EB",
    "alimentacao": "#F97316",
    "saude": "#EF4444",
    "educacao": "#2563EB",
    "lazer": "#A855F7",
    "pessoais": "#DB2777",
    "obrigacoes_financeiras": "#F59E0B",
    "trabalho": "#6366F1",
    "familia_filhos": "#EC4899",
    "receitas_e_investimentos": "#22C55E",
};

/**
 * Returns the effective color for a category.
 * If the category or its parent is a default category with a mapped color, it uses that.
 */
export const getCategoryColor = (category: AppCategory, allCategories?: AppCategory[]): string => {
    // 1. Check if the category itself has a mapped color (main categories)
    if (CATEGORY_COLOR_MAP[category.id]) {
        return CATEGORY_COLOR_MAP[category.id];
    }

    // 2. Check if it's a subcategory and its parent has a mapped color
    if (category.parent_id && CATEGORY_COLOR_MAP[category.parent_id]) {
        return CATEGORY_COLOR_MAP[category.parent_id];
    }

    // 3. If we have allCategories, try to find parent and its mapping (for deeper levels if any)
    if (allCategories && category.parent_id) {
        const parent = allCategories.find(c => c.id === category.parent_id);
        if (parent && CATEGORY_COLOR_MAP[parent.id]) {
            return CATEGORY_COLOR_MAP[parent.id];
        }
    }

    // 4. Fallback to the color stored in the database
    return category.cor;
};
