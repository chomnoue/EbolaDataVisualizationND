#Summary 
This visualization shows the evolution of <a href="http://www.who.int/mediacentre/factsheets/fs103/en/">Ebola</a> 
cases in West Africa from August 2014 to May 2015 as reported by the WHO. 
<br>
The user can select an indicator and a date to see the status on the map.
He can also chosse to replay the animation for the choosen indicator.

#Design
I choosed to show the affected country on a map whith the orange colour
differentiating them for the others. Only the affected countries are
named to let the user focus on them.<br>
 A red circle is use to show the value of an indicator for each country.
I choosed a logarithmic scale for the radius of the circles so that 
the values of countries with just few cases can be seen on the map.

####Changes from v1.0

* Added a line chart with an animated red circle to show the 
total number of cases changing over time
* Increased the radius of circles
* Shows only circles that have at least on case at each time

#Feedback 
* Hey, would be nice if you show the total cases number somewhere changing over time.
 Also, you could let the circles bigger. I played the animations sometimes, and 
I am still not sure if I have seen any circle in Mali.

#Resources
* http://d3js.org/
* d3jsrelated questions on http://stackoverflow.com
* http://www.w3schools.com/