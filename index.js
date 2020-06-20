const params = new URLSearchParams(window.location.search)

const {h,render,Component} = window.preact

class Container extends Component {
	constructor(props){
		super(props)
	}
	render(){
		return h('div',{class:'container'},
			h('div',{class:'navbar bg-secondary mb-2'},
				h('div',{class:'navbar-section'}),
				h('div',{class:'navbar-center'},
					h('img',{class:'img-responsive',style:'height: 3em',src:'img/logo.png'})
				),
				h('div',{class:'navbar-section'})
			),
			h('div',{class:'mt-2'},
				h('div',{class:'card'},
					h('div',{class:'card-header'},
						h('div',{class:'card-title h4 text-center'},'Who We Are')
					),
					h('div',{class:'card-body text-center'},
						h('p',undefined,`We're a fitness platform dedicated to connecting professionals with people who want to improve their health`)
					)
				),
				h('div',{class:'card mt-1'},
					h('div',{class:'card-header'},
						h('div',{class:'card-title h4 text-center'},'Customers')
					),
					h('div',{class:'card-body text-center'},
						h('p',undefined,`Customers can get started here`),
						h('a',{href:'customer/index.html'},'Customer Portal Link')
					)
				),
				h('div',{class:'card mt-1'},
					h('div',{class:'card-header'},
						h('div',{class:'card-title h4 text-center'},'Professionals')
					),
					h('div',{class:'card-body text-center'},
						h('p',undefined,`Professionals can get started here`),
						h('a',{href:'professional/index.html'},'Professional Portal Link')
					)
				)
			)
		)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))