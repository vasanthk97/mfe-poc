import React from 'react';
import * as ReactDOM from 'react-dom';
import {message} from 'pkg1';
import T from 'pkg1/lib/test';

export default class Test extends React.Component{

    render(){
        return (
            <div>
                {message}
            </div>
        )
    }
}

const container = document.getElementById('react-root');
ReactDOM.render(<Test />, container);