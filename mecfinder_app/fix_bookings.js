const fs = require('fs');
const content = fs.readFileSync('/home/anger/Projects/mecfinders/mecfinder_app/app/bookings/page.tsx', 'utf8');

const bannerSection = `      {/* Hero Banner */}
      <div className="px-5 mb-5 z-10 relative">
        <div className="rounded-[24px] overflow-hidden shadow-[0_10px_30px_rgb(19,31,51,0.12)] bg-[#131F33]">
          <img
            src="/img/book/book_banner.png"
            alt="Expert mechanics at your doorstep"
            className="w-full h-auto object-cover block"
          />
        </div>
      </div>`;

const toggleSectionMatch = content.match(/      \{\/\* Booking Type Toggle \*\/\}[\s\S]*?      \{\/\* Filter Pills \*\/\}/);
const toggleSection = toggleSectionMatch[0].replace('      {/* Filter Pills */}', '').trimEnd();

let newContent = content.replace(bannerSection, toggleSection + '\n\n' + bannerSection);
newContent = newContent.replace(toggleSectionMatch[0], '      {/* Filter Pills */}');

fs.writeFileSync('/home/anger/Projects/mecfinders/mecfinder_app/app/bookings/page.tsx', newContent);
