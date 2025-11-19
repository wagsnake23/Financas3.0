# AI Rules for Controle Financeiro Pessoal

This document outlines the core technologies used in this project and provides guidelines for their appropriate usage.

## Tech Stack Overview

*   **Frontend Framework**: React.js for building interactive user interfaces.
*   **Language**: TypeScript for type safety and improved code quality.
*   **Build Tool**: Vite for a fast development experience and optimized builds.
*   **UI Component Library**: shadcn/ui, providing accessible and customizable UI components built on Radix UI.
*   **Styling**: Tailwind CSS for utility-first styling, ensuring responsive and consistent designs.
*   **Routing**: React Router DOM for declarative client-side routing.
*   **Data Management**: Tanstack Query (React Query) for efficient server state management and data fetching.
*   **Backend & Authentication**: Supabase for database, authentication, and real-time functionalities.
*   **Icons**: Lucide React for a comprehensive set of customizable SVG icons.
*   **Form Handling**: React Hook Form for robust form management and validation with Zod.
*   **Charts**: Recharts for creating responsive data visualizations.
*   **Notifications**: Sonner for elegant and customizable toast notifications.

## Library Usage Rules

To maintain consistency and best practices, please adhere to the following rules when developing:

*   **UI Components**:
    *   Always prioritize using components from `shadcn/ui`.
    *   If a required component is not available in `shadcn/ui` or needs significant customization, create a new component in `src/components/` using Tailwind CSS. **Do not modify existing `shadcn/ui` component files.**
*   **Styling**:
    *   All styling must be done using **Tailwind CSS** utility classes. Avoid inline styles or separate CSS files unless absolutely necessary for global styles (e.g., `src/index.css`).
    *   Ensure designs are responsive by utilizing Tailwind's responsive utility classes.
*   **Routing**:
    *   Use `react-router-dom` for all navigation within the application.
    *   All main application routes should be defined in `src/App.tsx`.
*   **Data Fetching & State Management**:
    *   For server-side data fetching and caching, use **Tanstack Query (React Query)**.
    *   For simple component-level state, use React's `useState` and `useReducer` hooks.
*   **Authentication & Database**:
    *   All interactions with the backend (database operations, authentication flows) must use the **Supabase client** (`@supabase/supabase-js`).
*   **Icons**:
    *   Use icons from the `lucide-react` library.
*   **Forms**:
    *   Implement forms using `react-hook-form` for state management and validation.
    *   For schema validation, use `zod`.
*   **Charts**:
    *   When visualizing data, use components from the `recharts` library.
*   **Notifications**:
    *   For user feedback and notifications (e.g., success messages, errors), use the `sonner` library.
*   **File Structure**:
    *   New pages should be placed in `src/pages/`.
    *   New reusable components should be placed in `src/components/`.
    *   Hooks should be placed in `src/hooks/`.
    *   Utility functions should be placed in `src/lib/` or `src/utils/`.
    *   Directory names must be all lower-case. File names may use mixed-case (e.g., `MyComponent.tsx`).
*   **Error Handling**:
    *   Do not use `try/catch` blocks for API calls unless specifically requested. Allow errors to bubble up for centralized handling and debugging.
*   **Simplicity**:
    *   Always aim for simple and elegant solutions. Avoid over-engineering. Implement only what is requested, without adding unnecessary complexity or features.