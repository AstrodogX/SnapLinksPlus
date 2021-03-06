/*
 * Copyright (c) 2016 Clint Priest
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

let ElemDocRects;

"use strict";

class RectMapper {
	constructor() {
		this.clear();
	}

	/**
	 * Gets the elements bounding rect(s) in document coordinates
	 *
	 * @param elem    HtmlElement    The element being requested
	 * @param offset  object        The {x,y} offset the document is currently scrolled to (passed for performance reasons)
	 * @returns {Rect}
	 */
	get(elem, offset) {
		let Rects = this.ElemRects.get(elem);
		if(Rects)
			return Rects;

		Rects = this.GetElementRects(elem, offset);
		this.ElemRects.set(elem, Rects);
		return Rects;
	}

	/** Returns an array of { top, left, width, height } objects which combined make up the bounding rects of the given element,
	 *    this uses the built-in .getClientRects() and additionally compensates for 'block' elements which it would appear is not
	 *    handled appropriately for our needs by Mozilla or the standard
	 **/
	GetElementRects(elem, offset) {
		offset = offset || { x: 0, y: 0 };

		let Rects = $A(elem.getClientRects());

		$A(elem.querySelectorAll('IMG'))
			.forEach(function(elem) {
				Rects = Rects.concat($A(elem.getClientRects()));
			}, this);
		return Rects.map(function(rect) {
			return new Rect(rect.top + offset.y, rect.left + offset.x,
				rect.bottom + offset.y, rect.right + offset.x);
		});
	}

	clear() {
		this.ElemRects = new WeakMap();
	}
}

ElemDocRects = new RectMapper();

/**
 * This class is responsible for:
 *  - Identifying/Tracking which elements in the document are selectable
 *  - Quickly filtering selectable elements by a document coordinate rect
 */
class ElementIndexer {
	constructor() {
		this.Anchors = document.querySelectorAll('A[href]');

		this.UpdateIndex();
	}

	UpdateIndex() {
		let start     = Date.now(),
			elem, idx,
			docElem   = document.documentElement,
			scrollTop = docElem.scrollTop,
			docHeight = docElem.scrollHeight,
			Buckets   = data.IndexBuckets;
		let offset    = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };

		this.BoundaryIndex = [];
		for(let j = 0; j < Buckets; j++)
			this.BoundaryIndex[j] = [];

//		@PerfTest
//		var rr = new RateReporter('Calculated ${Count} Elements in ${Elapsed} (${PerSecond})');
		for(elem of this.Anchors) {
			/* GetBucketFromTop() */
			idx = Math.floor((elem.getBoundingClientRect().top + scrollTop) * Buckets / docHeight);
			if(this.BoundaryIndex[idx])
				this.BoundaryIndex[idx].push(elem);
//			@PerfTest
//			ElemDocRects.get(elem, offset);
		}
//		@PerfTest
//		rr.report(this.Anchors.length);
	}

	isVisible(element) {
		let style = window.getComputedStyle(element);
		return style.width !== 0 &&
			style.height !== 0 &&
			style.opacity !== 0 &&
			style.display !== 'none' &&
			style.visibility !== 'hidden';
	}

	/**
	 *
	 * @param SelectionRect
	 */
	Search(SelectionRect) {
		let docHeight   = document.documentElement.scrollHeight,
			Buckets     = data.IndexBuckets,
			/* GetBucketFromTop() */
			FirstBucket = Math.floor(SelectionRect.top * Buckets / docHeight),
			/* GetBucketFromTop() */
			LastBucket  = Math.floor(SelectionRect.bottom * Buckets / docHeight),
			offset      = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop },
			tMatches    = [];

		for(let j = FirstBucket; j <= LastBucket; j++) {
			for(let elem of this.BoundaryIndex[j]) {
				if (this.isVisible(elem) == false) {
					continue;
				}
				for(let r of ElemDocRects.get(elem, offset)) {
					if(SelectionRect.intersects(r)) {
						tMatches.push(elem);
						break;	// for(let r...
					}
				}
			}
		}
		return tMatches;
	}
}

