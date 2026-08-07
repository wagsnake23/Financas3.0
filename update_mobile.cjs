const fs = require('fs');

function updateFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Left side secondary stats gap: gap-0.5 -> gap-0 md:gap-0.5
  content = content.replace(
    /className="flex flex-col items-start gap-0.5"/g,
    'className="flex flex-col items-start gap-0 md:gap-0.5"'
  );

  // 2. Right side (Annual totals) gap: gap-0.5 -> gap-0 md:gap-0.5
  content = content.replace(
    /className=\{cn\(\s*"flex flex-col items-end gap-0.5",/g,
    'className={cn(\n              "flex flex-col items-end gap-0 md:gap-0.5",'
  );

  // 3. Right side (Annual totals) value margin: mt-0.5 -> mt-0 md:mt-0.5
  // Also ensure font sizes for value are correct (14px/15px)
  content = content.replace(
    /className=\{cn\("font-extrabold text-slate-800 font-roboto leading-none tracking-tight mt-0.5", isMobile \? "text-\[12px\]" : "text-\[13px\]"\)\}/g,
    'className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")}'
  );
  content = content.replace(
    /className=\{cn\("font-extrabold text-slate-800 font-roboto leading-none tracking-tight mt-0.5", isMobile \? "text-\[13px\]" : "text-\[14px\]"\)\}/g,
    'className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")}'
  );
  // ProjectedYieldCard has a different size maybe
  content = content.replace(
    /className=\{cn\(\s*"font-extrabold text-slate-800 font-roboto leading-none tracking-tight mt-0.5",\s*isMobile \? "text-\[12px\]" : "text-\[13px\]"\s*\)\}/g,
    'className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")}'
  );
  content = content.replace(
    /className=\{cn\(\s*"font-extrabold text-slate-800 font-roboto leading-none tracking-tight mt-0.5",\s*isMobile \? "text-\[13px\]" : "text-\[14px\]"\s*\)\}/g,
    'className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")}'
  );

  // 4. Trend indicator - replace completely
  const oldTrendRegex = /\{\/\* Tendência integrada ao Bottom \*\/\}\s*\{trend && trend\.includes\('%'\) && \(\s*<div className=\{cn\([\s\S]*?<\/div>\s*\)\}/g;
  const newTrend = `{/* Tendência integrada ao Bottom */}
          {trend && trend.includes('%') && (
            <div className={cn(
              "flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none gap-1 self-end mb-0.5 shadow-sm",
              dashboardPremiumStyle 
                ? (trendIsPositive ? "bg-emerald-100/70 text-emerald-700" : "bg-rose-100/70 text-rose-700")
                : headerBadgeStyles[variant]
            )}>
              <DynamicIcon 
                name={trendIsPositive ? "TrendingUp" : "TrendingDown"} 
                className="h-3 w-3" 
                strokeWidth={3} 
              />
              <span>{trend.split(' ')[0].replace(/[+-]/g, '')}</span>
            </div>
          )}`;
  
  if (content.match(oldTrendRegex)) {
    content = content.replace(oldTrendRegex, newTrend);
  }

  fs.writeFileSync(file, content);
}

updateFile('src/components/StatCard.tsx');
updateFile('src/components/ProjectedYieldCard.tsx');
console.log("Updated both files");
